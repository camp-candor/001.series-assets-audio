import fs from 'fs-extra'
import path from 'path'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type {
    CharacterProfileSummary,
    CharacterRegistrationPayload,
} from '../fce/characterResolution.interface.js'

export const normalizeCharacterSlug = (raw: string): string => {
    return (raw || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
}

export const parseManifestCharacters = async (
    manifestPath: string,
): Promise<Record<string, any>> => {
    if (!(await fs.pathExists(manifestPath))) {
        return {}
    }
    try {
        const raw = await fs.readJson(manifestPath)
        return raw.voices || raw.characters || raw
    } catch {
        return {}
    }
}

export const matchExistingCharacter = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const rootDir = bal?.src || cpy.voicesRoot || process.cwd()
    const manifestPath =
        (bal?.dat as any)?.manifestPath ||
        path.resolve(rootDir, 'voices', 'voice_manifest.json')

    const voicesMap = await parseManifestCharacters(manifestPath)
    const profiles: CharacterProfileSummary[] = []

    for (const [slug, data] of Object.entries(voicesMap)) {
        if (typeof data !== 'object' || !data) continue

        const conditions = data.condition_variants
            ? Object.keys(data.condition_variants)
            : ['neutral']

        let highestVer = 0
        if (data.condition_variants) {
            for (const cond of Object.values<any>(data.condition_variants)) {
                if (cond && cond.active_version) {
                    const match = String(cond.active_version).match(/v?(\d+)/i)
                    if (match) {
                        const num = parseInt(match[1], 10)
                        if (num > highestVer) highestVer = num
                    }
                }
            }
        } else if (data.active_version) {
            const match = String(data.active_version).match(/v?(\d+)/i)
            if (match) highestVer = parseInt(match[1], 10)
        }

        profiles.push({
            characterSlug: slug,
            displayName: data.display_name || slug,
            baseState: data.base_state || 'neutral',
            latestVersion: highestVer,
            latestVersionTag: `v${highestVer}`,
            registeredConditions: conditions,
            isExisting: true,
        })
    }

    profiles.sort((a, b) => a.characterSlug.localeCompare(b.characterSlug))

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [CHARACTER] Manifest query returned ${profiles.length} registered character identities.`,
            })
            .catch(() => {})
    }

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'match-existing-character',
                val: profiles.length,
                dat: profiles,
                src: manifestPath,
            },
        })
    }

    return cpy
}

export const scaffoldNewCharacterProfile = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const payload: CharacterRegistrationPayload = (bal?.dat as any) || {}
    const rawSlug = payload.characterSlug || bal?.src || ''
    const cleanSlug = normalizeCharacterSlug(rawSlug)

    if (!cleanSlug) {
        const errorMsg =
            'CHARACTER_SLUG_EMPTY_BREACH: Normalized character slug cannot be empty.'
        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: `:: [CHARACTER:ERR] ${errorMsg}`,
                })
                .catch(() => {})
        }
        const err = new Error(errorMsg)
        if (bal?.slv) {
            bal.slv({
                voiBit: {
                    idx: 'scaffold-new-character-fail',
                    val: -1,
                    src: rawSlug,
                },
            })
        }
        throw err
    }

    const rootDir = cpy.voicesRoot || process.cwd()
    const manifestPath = path.resolve(rootDir, 'voices', 'voice_manifest.json')
    const existingVoices = await parseManifestCharacters(manifestPath)

    if (existingVoices[cleanSlug]) {
        const errorMsg = `CHARACTER_ALREADY_REGISTERED_BREACH: Character [${cleanSlug}] is already registered in manifest.`
        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: `:: [CHARACTER:ERR] ${errorMsg}`,
                })
                .catch(() => {})
        }
        const err = new Error(errorMsg)
        if (bal?.slv) {
            bal.slv({
                voiBit: {
                    idx: 'scaffold-new-character-fail',
                    val: -1,
                    src: cleanSlug,
                },
            })
        }
        throw err
    }

    const profile: CharacterProfileSummary = {
        characterSlug: cleanSlug,
        displayName: payload.displayName || cleanSlug,
        baseState: 'neutral',
        latestVersion: 0,
        latestVersionTag: 'v0',
        registeredConditions: ['neutral'],
        isExisting: false,
    }

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [SCAFFOLD] Initialized candidate character profile: [${cleanSlug}] (${profile.displayName}).`,
            })
            .catch(() => {})
    }

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'scaffold-new-character',
                val: 0,
                dat: profile,
                src: cleanSlug,
            },
        })
    }

    return cpy
}
