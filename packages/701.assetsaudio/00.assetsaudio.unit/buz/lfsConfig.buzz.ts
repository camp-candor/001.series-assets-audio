import fs from 'fs-extra'
import path from 'path'
import type { AssetsAudioModel } from '../assetsaudio.model.js'
import type AssetsAudioBit from '../fce/assetsaudio.bit.js'

export const MANDATORY_LFS_PATTERNS = [
    '*.wav filter=lfs diff=lfs merge=lfs -text',
    '*.mp3 filter=lfs diff=lfs merge=lfs -text',
    '*.flac filter=lfs diff=lfs merge=lfs -text',
    '*.pt filter=lfs diff=lfs merge=lfs -text',
]

export const initAssetsAudio = async (
    cpy: AssetsAudioModel,
    bal: AssetsAudioBit,
    ste?: any,
): Promise<AssetsAudioModel> => {
    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: '>> [VAULT] Initializing Local Acoustic Asset Vault Foundation...',
            })
            .catch(() => {})
    }

    if (bal?.slv) {
        bal.slv({ asbBit: { idx: 'init-assetsaudio', val: 0 } })
    }
    return cpy
}

export const configureLfs = async (
    cpy: AssetsAudioModel,
    bal: AssetsAudioBit,
    ste?: any,
): Promise<AssetsAudioModel> => {
    const rootDir = bal?.src || cpy.vaultRoot
    const gitattributesPath = path.resolve(rootDir, '.gitattributes')

    let existingContent = ''
    if (await fs.pathExists(gitattributesPath)) {
        existingContent = await fs.readFile(gitattributesPath, 'utf8')
    }

    const lines = new Set(
        existingContent
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0),
    )

    let modified = false
    for (const pattern of MANDATORY_LFS_PATTERNS) {
        if (!lines.has(pattern)) {
            lines.add(pattern)
            modified = true
        }
    }

    if (modified || !(await fs.pathExists(gitattributesPath))) {
        const finalContent = Array.from(lines).sort().join('\n') + '\n'
        await fs.writeFile(gitattributesPath, finalContent, 'utf8')

        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: '>> [LFS] Conformed .gitattributes LFS binary tracking rules.',
                })
                .catch(() => {})
        }
    }

    cpy.lfsInitialized = true

    if (bal?.slv) {
        bal.slv({
            asbBit: {
                idx: 'configure-lfs',
                val: lines.size,
                src: gitattributesPath,
            },
        })
    }

    return cpy
}
