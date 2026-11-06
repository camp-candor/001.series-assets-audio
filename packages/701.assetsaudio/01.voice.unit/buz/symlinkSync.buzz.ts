import fs from 'fs-extra'
import path from 'path'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type { SymlinkSyncReceipt } from '../fce/voice.bit.js'

export const resolveLatestVersionFile = async (
    versionsDir: string,
    characterSlug: string,
): Promise<{ fileName: string; versionTag: string } | null> => {
    if (!(await fs.pathExists(versionsDir))) return null
    const entries = await fs.readdir(versionsDir)

    const pattern = new RegExp(`^${characterSlug}_v(\\d+)\\.wav$`, 'i')
    let highestVersion = -1
    let matchingFile: string | null = null

    for (const entry of entries) {
        const match = entry.match(pattern)
        if (match) {
            const ver = parseInt(match[1], 10)
            if (ver > highestVersion) {
                highestVersion = ver
                matchingFile = entry
            }
        }
    }

    if (!matchingFile) return null
    return { fileName: matchingFile, versionTag: `v${highestVersion}` }
}

export const syncFloatingSymlinks = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const rootDir = bal?.src || cpy.voicesRoot
    const voicesBase = path.resolve(rootDir, 'voices')
    const versionsDir = path.join(voicesBase, 'versions')
    const activeDir = path.join(voicesBase, 'active')

    await fs.ensureDir(versionsDir)
    await fs.ensureDir(activeDir)

    const characterSlug = (bal?.dat as any)?.characterSlug
    const receipts: SymlinkSyncReceipt[] = []

    const discoverSlugs = async (): Promise<string[]> => {
        if (characterSlug) return [characterSlug]
        const entries = await fs.readdir(versionsDir)
        const slugs = new Set<string>()
        for (const entry of entries) {
            const match = entry.match(/^([a-z0-9_]+)_v\d+\.wav$/i)
            if (match) {
                slugs.add(match[1])
            }
        }
        return Array.from(slugs)
    }

    const slugs = await discoverSlugs()

    for (const slug of slugs) {
        const latest = await resolveLatestVersionFile(versionsDir, slug)
        if (!latest) continue

        const symlinkPath = path.join(activeDir, `${slug}.wav`)
        const relativeTarget = path.join('..', 'versions', latest.fileName)
        const absoluteTarget = path.join(versionsDir, latest.fileName)

        let needsRelink = true
        if (await fs.pathExists(symlinkPath)) {
            try {
                const currentLink = await fs.readlink(symlinkPath)
                if (
                    currentLink === relativeTarget ||
                    currentLink === absoluteTarget
                ) {
                    needsRelink = false
                } else {
                    await fs.remove(symlinkPath)
                }
            } catch {
                await fs.remove(symlinkPath)
            }
        }

        if (needsRelink) {
            await fs.symlink(relativeTarget, symlinkPath)
            if (ste?.hunt) {
                await ste
                    .hunt('[Console action] Update Console', {
                        idx: 'cns00',
                        src: `>> [SYMLINK] Pointed active/${slug}.wav -> ${relativeTarget}`,
                    })
                    .catch(() => {})
            }
        }

        receipts.push({
            characterId: slug,
            activeSymlinkPath: symlinkPath,
            targetVersionPath: absoluteTarget,
            versionTag: latest.versionTag,
            isResolved: true,
        })
    }

    cpy.activeVersionsCount = receipts.length

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'sync-floating-symlinks',
                val: receipts.length,
                dat: receipts,
                src: activeDir,
            },
        })
    }

    return cpy
}
