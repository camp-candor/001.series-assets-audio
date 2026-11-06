import fs from 'fs-extra'
import path from 'path'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type {
    VersionResolutionOptions,
    VersionResolutionResult,
} from '../fce/characterResolution.interface.js'

export const scanVersionsDirectoryForCharacter = async (
    versionsDir: string,
    characterSlug: string,
    conditionTag?: string,
): Promise<number[]> => {
    if (!(await fs.pathExists(versionsDir))) {
        return []
    }

    const entries = await fs.readdir(versionsDir)
    const versions: number[] = []

    // Match: <characterSlug>_v<N>.wav OR <characterSlug>_<condition>_v<N>.wav
    const regex = conditionTag
        ? new RegExp(`^${characterSlug}_${conditionTag}_v(\\d+)\\.wav$`, 'i')
        : new RegExp(`^${characterSlug}_(?:[a-z0-9_]+_)?v(\\d+)\\.wav$`, 'i')

    for (const file of entries) {
        const match = file.match(regex)
        if (match) {
            versions.push(parseInt(match[1], 10))
        }
    }

    return versions.sort((a, b) => a - b)
}

export const resolveMonotonicVersion = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const options: VersionResolutionOptions = (bal?.dat as any) || {}
    const rawSlug = options.characterSlug || bal?.src || ''
    const characterSlug = (rawSlug || '').trim().toLowerCase()
    const conditionTag = (options.conditionTag || '').trim().toLowerCase()
    const requestedVersion = options.requestedVersion

    if (!characterSlug) {
        const errorMsg =
            'VERSION_RESOLVE_SLUG_EMPTY: Character slug must be provided.'
        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: `:: [VERSION:ERR] ${errorMsg}`,
                })
                .catch(() => {})
        }
        const err = new Error(errorMsg)
        if (bal?.slv) {
            bal.slv({
                voiBit: { idx: 'resolve-monotonic-version-fail', val: -1 },
            })
        }
        throw err
    }

    const rootDir = cpy.voicesRoot || process.cwd()
    const versionsDir = path.resolve(rootDir, 'voices', 'versions')
    await fs.ensureDir(versionsDir)

    const existingVersions = await scanVersionsDirectoryForCharacter(
        versionsDir,
        characterSlug,
        conditionTag || undefined,
    )

    const maxVersion =
        existingVersions.length > 0
            ? existingVersions[existingVersions.length - 1]
            : 0

    // Enforce Monotonic Version Progression Invariant
    if (requestedVersion !== undefined) {
        if (requestedVersion <= maxVersion) {
            const errorMsg = `MONOTONIC_VERSION_REGRESSION_BREACH: Requested version (${requestedVersion}) must be strictly greater than active maximum version (${maxVersion}).`
            if (ste?.hunt) {
                await ste
                    .hunt('[Console action] Update Console', {
                        idx: 'cns00',
                        src: `:: [VERSION:FAIL] ${errorMsg}`,
                    })
                    .catch(() => {})
            }
            const err = new Error(errorMsg)
            if (bal?.slv) {
                bal.slv({
                    voiBit: {
                        idx: 'resolve-monotonic-version-fail',
                        val: -1,
                        src: characterSlug,
                    },
                })
            }
            throw err
        }
    }

    const nextVersion =
        requestedVersion !== undefined ? requestedVersion : maxVersion + 1
    const targetFileName = conditionTag
        ? `${characterSlug}_${conditionTag}_v${nextVersion}.wav`
        : `${characterSlug}_v${nextVersion}.wav`

    const result: VersionResolutionResult = {
        characterSlug,
        currentVersion: maxVersion,
        currentVersionTag: `v${maxVersion}`,
        nextVersion,
        nextVersionTag: `v${nextVersion}`,
        targetFileName,
        isNewCharacter: maxVersion === 0,
    }

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [VERSION:RESOLVE] Character [${characterSlug}] version calculated: ${result.currentVersionTag} -> ${result.nextVersionTag} (${targetFileName}).`,
            })
            .catch(() => {})
    }

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'resolve-monotonic-version',
                val: nextVersion,
                dat: result,
                src: targetFileName,
            },
        })
    }

    return cpy
}
