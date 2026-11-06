import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import type { AssetsAudioModel } from '../assetsaudio.model.js'
import type AssetsAudioBit from '../fce/assetsaudio.bit.js'
import type { PoisonAuditReport } from '../fce/assetsaudio.bit.js'

export const EMPTY_STRING_SHA256 =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
export const MINIMUM_HYDRATED_BYTE_SIZE = 1024

export const computeFileSha256 = async (filePath: string): Promise<string> => {
    const buffer = await fs.readFile(filePath)
    return createHash('sha256').update(buffer).digest('hex')
}

export const inspectAudioBuffer = async (
    filePath: string,
): Promise<PoisonAuditReport> => {
    const stat = await fs.stat(filePath)
    const byteSize = stat.size
    const sha256 = await computeFileSha256(filePath)

    if (byteSize === 0 || sha256 === EMPTY_STRING_SHA256) {
        return {
            filePath,
            byteSize,
            sha256,
            isHydrated: false,
            status: 'FAILED',
            error: 'ZERO_BYTE_POISON_BREACH: Target matches empty string SHA-256 digest',
        }
    }

    if (byteSize < MINIMUM_HYDRATED_BYTE_SIZE) {
        return {
            filePath,
            byteSize,
            sha256,
            isHydrated: false,
            status: 'FAILED',
            error: 'UNHYDRATED_LFS_POINTER_BREACH: File byte size is below 1024 byte minimum',
        }
    }

    return {
        filePath,
        byteSize,
        sha256,
        isHydrated: true,
        status: 'PASSED',
    }
}

export const auditPoisonBuffers = async (
    cpy: AssetsAudioModel,
    bal: AssetsAudioBit,
    ste?: any,
): Promise<AssetsAudioModel> => {
    const targetDir = path.resolve(
        bal?.src || path.join(cpy.vaultRoot, 'voices'),
    )
    const reports: PoisonAuditReport[] = []

    const discoverFiles = async (dir: string): Promise<string[]> => {
        if (!(await fs.pathExists(dir))) return []
        const entries = await fs.readdir(dir, { withFileTypes: true })
        const collected: string[] = []

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                collected.push(...(await discoverFiles(fullPath)))
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase()
                if (['.wav', '.mp3', '.flac', '.pt'].includes(ext)) {
                    collected.push(fullPath)
                }
            }
        }
        return collected
    }

    const files = await discoverFiles(targetDir)
    let failureCount = 0

    for (const file of files) {
        const report = await inspectAudioBuffer(file)
        reports.push(report)

        if (report.status === 'FAILED') {
            failureCount++
            if (ste?.hunt) {
                await ste
                    .hunt('[Console action] Update Console', {
                        idx: 'cns00',
                        src: `:: [POISON_SENTRY:FAIL] File ${path.basename(file)} faulted: ${report.error}`,
                    })
                    .catch(() => {})
            }
        }
    }

    if (failureCount > 0) {
        const breachError = new Error(
            `POISON_AUDIT_BREACH: Detected ${failureCount} unhydrated or zero-byte media file(s).`,
        )
        if (bal?.slv) {
            bal.slv({
                asbBit: {
                    idx: 'audit-poison-buffers-fail',
                    val: failureCount,
                    dat: reports,
                    src: targetDir,
                },
            })
        }
        throw breachError
    }

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [POISON_SENTRY:OK] Audited ${files.length} binary files. All LFS buffers fully hydrated.`,
            })
            .catch(() => {})
    }

    if (bal?.slv) {
        bal.slv({
            asbBit: {
                idx: 'audit-poison-buffers',
                val: files.length,
                dat: reports,
                src: targetDir,
            },
        })
    }

    return cpy
}
