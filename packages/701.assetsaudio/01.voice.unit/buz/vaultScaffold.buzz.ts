import fs from 'fs-extra'
import path from 'path'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type { VoiceScaffoldResult } from '../fce/voice.bit.js'

export const initVoice = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: '>> [VOICE] Voice Authority Unit Initialized.',
            })
            .catch(() => {})
    }
    if (bal?.slv) {
        bal.slv({ voiBit: { idx: 'init-voice', val: 0 } })
    }
    return cpy
}

export const scaffoldVault = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const rootDir = bal?.src || cpy.voicesRoot
    const voicesBase = path.resolve(rootDir, 'voices')

    const versionsDir = path.join(voicesBase, 'versions')
    const activeDir = path.join(voicesBase, 'active')
    const embeddingsDir = path.join(voicesBase, 'embeddings')

    const targetDirs = [versionsDir, activeDir, embeddingsDir]
    const createdDirs: string[] = []

    for (const dir of targetDirs) {
        if (!(await fs.pathExists(dir))) {
            await fs.ensureDir(dir)
            createdDirs.push(dir)
        }
    }

    // Enforce read-only immutability on versions directory files if any exist
    if (await fs.pathExists(versionsDir)) {
        const entries = await fs.readdir(versionsDir)
        for (const file of entries) {
            const fullPath = path.join(versionsDir, file)
            const stat = await fs.stat(fullPath)
            if (stat.isFile()) {
                await fs.chmod(fullPath, 0o444)
            }
        }
    }

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [VAULT] Provisioned two-tier voice storage hierarchy in ${path.relative(rootDir, voicesBase)}`,
            })
            .catch(() => {})
    }

    const result: VoiceScaffoldResult = {
        versionsDir,
        activeDir,
        embeddingsDir,
        createdDirs,
    }

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'scaffold-vault',
                val: createdDirs.length,
                dat: result,
                src: voicesBase,
            },
        })
    }

    return cpy
}
