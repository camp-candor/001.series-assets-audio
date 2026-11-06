import fs from 'fs-extra'
import path from 'path'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type { InodeValidationResult } from '../fce/ingressValidate.interface.js'

export const SUPPORTED_AUDIO_EXTENSIONS = new Set([
    '.wav',
    '.mp3',
    '.flac',
    '.aiff',
    '.m4a',
])

export const inspectAudioInode = async (
    rawPath: string,
    baseDir: string = process.cwd(),
): Promise<InodeValidationResult> => {
    const cleanPath = (rawPath || '').trim()
    if (!cleanPath) {
        return {
            filePath: '',
            absolutePath: '',
            exists: false,
            isReadable: false,
            isFile: false,
            byteSize: 0,
            extension: '',
            status: 'INVALID',
            error: 'FILE_PATH_EMPTY_BREACH: No file path provided for validation',
        }
    }

    const resolved = path.isAbsolute(cleanPath)
        ? cleanPath
        : path.resolve(baseDir, cleanPath)

    const ext = path.extname(resolved).toLowerCase()

    if (!(await fs.pathExists(resolved))) {
        return {
            filePath: cleanPath,
            absolutePath: resolved,
            exists: false,
            isReadable: false,
            isFile: false,
            byteSize: 0,
            extension: ext,
            status: 'INVALID',
            error: `FILE_NOT_FOUND_BREACH: Target file does not exist on disk: ${resolved}`,
        }
    }

    let stat: fs.Stats
    try {
        stat = await fs.stat(resolved)
    } catch (err: any) {
        return {
            filePath: cleanPath,
            absolutePath: resolved,
            exists: true,
            isReadable: false,
            isFile: false,
            byteSize: 0,
            extension: ext,
            status: 'INVALID',
            error: `FILE_UNREADABLE_BREACH: Failed to access file stats: ${err.message}`,
        }
    }

    if (stat.isDirectory()) {
        return {
            filePath: cleanPath,
            absolutePath: resolved,
            exists: true,
            isReadable: true,
            isFile: false,
            byteSize: stat.size,
            extension: ext,
            status: 'INVALID',
            error: `NOT_A_FILE_BREACH: Path points to a directory, not an audio file: ${resolved}`,
        }
    }

    if (stat.size === 0) {
        return {
            filePath: cleanPath,
            absolutePath: resolved,
            exists: true,
            isReadable: true,
            isFile: true,
            byteSize: 0,
            extension: ext,
            status: 'INVALID',
            error: `ZERO_BYTE_INGRESS_BREACH: File size is 0 bytes: ${resolved}`,
        }
    }

    if (!SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
        return {
            filePath: cleanPath,
            absolutePath: resolved,
            exists: true,
            isReadable: true,
            isFile: true,
            byteSize: stat.size,
            extension: ext,
            status: 'INVALID',
            error: `UNSUPPORTED_CONTAINER_BREACH: Extension [${ext}] is not a supported audio format`,
        }
    }

    return {
        filePath: cleanPath,
        absolutePath: resolved,
        exists: true,
        isReadable: true,
        isFile: true,
        byteSize: stat.size,
        extension: ext,
        status: 'VALID',
    }
}

export const validateSourceInode = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const targetPath = bal?.src || (bal?.dat as any)?.filePath || ''
    const rootDir =
        (bal?.dat as any)?.baseDir || cpy.voicesRoot || process.cwd()

    const report = await inspectAudioInode(targetPath, rootDir)

    if (report.status === 'INVALID') {
        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: `:: [INGRESS:ERR] Source file not reachable on disk: ${report.error}`,
                })
                .catch(() => {})
        }

        const breachError = new Error(report.error)
        if (bal?.slv) {
            bal.slv({
                voiBit: {
                    idx: 'validate-source-inode-fail',
                    val: -1,
                    src: report.absolutePath,
                    dat: report,
                },
            })
        }
        throw breachError
    }

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [INGRESS:OK] Target inode locked: [${report.absolutePath}] (${report.byteSize} bytes).`,
            })
            .catch(() => {})
    }

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'validate-source-inode',
                val: report.byteSize,
                dat: report,
                src: report.absolutePath,
            },
        })
    }

    return cpy
}
