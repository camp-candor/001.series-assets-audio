import fs from 'fs-extra'
import path from 'path'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type {
    ConditionVariantRegistrationPayload,
    ConditionVaultAuditResult,
} from '../fce/conditionVault.interface.js'

const CONDITION_TAG_PATTERN = /^[a-z0-9_]+$/
const RESERVED_CONDITION_TAG = 'neutral'

const emitConsole = async (ste: any, src: string): Promise<void> => {
    if (!ste?.hunt) return
    await ste
        .hunt('[Console action] Update Console', { idx: 'cns00', src })
        .catch(() => {})
}

const canonicalize = (value: any): any => {
    if (Array.isArray(value)) return value.map(canonicalize)
    if (value && typeof value === 'object') {
        const sorted: Record<string, any> = {}
        for (const k of Object.keys(value).sort()) {
            sorted[k] = canonicalize(value[k])
        }
        return sorted
    }
    return value
}

const escapeRegex = (raw: string): string =>
    raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const readManifest = async (
    manifestPath: string,
): Promise<Record<string, any>> => {
    if (!(await fs.pathExists(manifestPath))) return {}
    try {
        return await fs.readJson(manifestPath)
    } catch {
        return {}
    }
}

const writeManifestAtomic = async (
    manifestPath: string,
    manifest: Record<string, any>,
): Promise<void> => {
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const tmpPath = path.join(
        path.dirname(manifestPath),
        `.tmp_manifest_${nonce}.json`,
    )
    await fs.writeJson(tmpPath, canonicalize(manifest), { spaces: 2 })
    await fs.rename(tmpPath, manifestPath)
}

export const normalizeConditionTag = (raw: string): string => {
    return (raw || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
}

export const registerConditionVariant = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const payload: ConditionVariantRegistrationPayload = (bal?.dat as any) || {}
    const characterSlug = (payload.characterSlug || bal?.src || '')
        .trim()
        .toLowerCase()
    const rawTag = payload.conditionTag || ''
    const cleanTag = normalizeConditionTag(rawTag)

    if (
        !cleanTag ||
        cleanTag === RESERVED_CONDITION_TAG ||
        !CONDITION_TAG_PATTERN.test(cleanTag) ||
        !characterSlug
    ) {
        const errorMsg = `CONDITION_TAG_INVALID_BREACH: Condition tag [${rawTag}] for [${characterSlug}] is empty, reserved, or invalid.`
        await emitConsole(ste, `:: [CONDITION:ERR] ${errorMsg}`)
        if (bal?.slv) {
            bal.slv({
                voiBit: { idx: 'register-condition-variant-fail', val: -1 },
            })
        }
        throw new Error(errorMsg)
    }

    const rootDir = cpy.voicesRoot || process.cwd()
    const manifestPath = path.resolve(rootDir, 'voices', 'voice_manifest.json')
    await fs.ensureDir(path.dirname(manifestPath))

    const manifest = await readManifest(manifestPath)
    if (!manifest.voices) manifest.voices = {}
    if (!manifest.voices[characterSlug]) {
        manifest.voices[characterSlug] = {
            display_name: characterSlug,
            base_state: RESERVED_CONDITION_TAG,
            active_version: 'v1',
        }
    }

    const charEntry = manifest.voices[characterSlug]
    if (!charEntry.condition_variants) charEntry.condition_variants = {}
    const existing = charEntry.condition_variants[cleanTag] || {}

    charEntry.condition_variants[cleanTag] = {
        ...existing,
        active_version: existing.active_version || 'v1',
        somatic_trigger:
            payload.somaticTrigger ||
            existing.somatic_trigger ||
            'unspecified_trigger',
        description:
            payload.description ||
            existing.description ||
            `Somatic state ${cleanTag}`,
        dsp_overrides: payload.dspOverrides || existing.dsp_overrides || {},
        updated_at: new Date().toISOString(),
    }

    await writeManifestAtomic(manifestPath, manifest)

    await emitConsole(
        ste,
        `>> [CONDITION:REGISTER] Registered condition [${cleanTag}] for [${characterSlug}].`,
    )

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'register-condition-variant',
                val: 0,
                dat: canonicalize(charEntry.condition_variants[cleanTag]),
                src: cleanTag,
            },
        })
    }

    return cpy
}

export const resolveConditionTakes = async (
    versionsDir: string,
    characterSlug: string,
    conditionTag: string,
): Promise<{ versions: number[]; latestVersion: number }> => {
    if (!(await fs.pathExists(versionsDir))) {
        return { versions: [], latestVersion: 0 }
    }

    const regex = new RegExp(
        `^${escapeRegex(characterSlug)}_${escapeRegex(conditionTag)}_v(\\d+)\\.wav$`,
    )
    const files = await fs.readdir(versionsDir)
    const versions: number[] = []

    for (const f of files) {
        const m = f.match(regex)
        if (m) versions.push(parseInt(m[1], 10))
    }

    versions.sort((a, b) => a - b)
    const latestVersion =
        versions.length > 0 ? versions[versions.length - 1] : 0
    return { versions, latestVersion }
}

export const retargetConditionSymlink = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const payload = (bal?.dat as any) || {}
    const characterSlug = (payload.characterSlug || bal?.src || '')
        .trim()
        .toLowerCase()
    const conditionTag = normalizeConditionTag(payload.conditionTag || '')
    const versionNumber = Number(payload.versionNumber)

    if (
        !characterSlug ||
        !conditionTag ||
        conditionTag === RESERVED_CONDITION_TAG ||
        !Number.isInteger(versionNumber) ||
        versionNumber < 1
    ) {
        const errorMsg =
            'RETARGET_PAYLOAD_INVALID: characterSlug, non-neutral conditionTag, and positive integer versionNumber required.'
        await emitConsole(ste, `:: [SYMLINK:ERR] ${errorMsg}`)
        if (bal?.slv) {
            bal.slv({
                voiBit: { idx: 'retarget-condition-symlink-fail', val: -1 },
            })
        }
        throw new Error(errorMsg)
    }

    const rootDir = cpy.voicesRoot || process.cwd()
    const voicesBase = path.resolve(rootDir, 'voices')
    const activeDir = path.join(voicesBase, 'active')
    await fs.ensureDir(activeDir)

    const versionTag = `v${versionNumber}`
    const fileName = `${characterSlug}_${conditionTag}_${versionTag}.wav`
    const symlinkName = `${characterSlug}--${conditionTag}.wav`
    const activeSymlinkPath = path.join(activeDir, symlinkName)
    const relativeTarget = path.join('..', 'versions', fileName)

    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const stageLinkPath = path.join(activeDir, `.tmp_link_${nonce}.wav`)

    await fs.symlink(relativeTarget, stageLinkPath)
    try {
        await fs.rename(stageLinkPath, activeSymlinkPath)
    } catch (err) {
        await fs.remove(stageLinkPath).catch(() => {})
        throw err
    }

    const manifestPath = path.join(voicesBase, 'voice_manifest.json')
    if (await fs.pathExists(manifestPath)) {
        const manifest = await readManifest(manifestPath)
        const charEntry = manifest.voices?.[characterSlug]
        if (charEntry) {
            if (!charEntry.condition_variants) charEntry.condition_variants = {}
            charEntry.condition_variants[conditionTag] = {
                ...(charEntry.condition_variants[conditionTag] || {}),
                active_version: versionTag,
                updated_at: new Date().toISOString(),
            }
            await writeManifestAtomic(manifestPath, manifest)
        }
    }

    await emitConsole(
        ste,
        `>> [SYMLINK:CONDITION] Swapped active condition pointer -> ${symlinkName}.`,
    )

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'retarget-condition-symlink',
                val: versionNumber,
                dat: { activeSymlinkPath, relativeTarget, fileName },
                src: symlinkName,
            },
        })
    }

    return cpy
}

export const auditConditionVault = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const dat = (bal?.dat as any) || {}
    const characterSlug = (bal?.src || dat.characterSlug || '')
        .trim()
        .toLowerCase()
    const strict = dat.strict === true
    const rootDir = cpy.voicesRoot || process.cwd()
    const voicesBase = path.resolve(rootDir, 'voices')
    const manifestPath = path.join(voicesBase, 'voice_manifest.json')
    const versionsDir = path.join(voicesBase, 'versions')
    const activeDir = path.join(voicesBase, 'active')
    const embeddingsDir = path.join(voicesBase, 'embeddings')

    await emitConsole(
        ste,
        `>> [VAULT:AUDIT] Auditing condition takes for [${characterSlug}]...`,
    )

    const manifest = await readManifest(manifestPath)
    const charData = manifest.voices?.[characterSlug]
    const auditResult: ConditionVaultAuditResult = {
        characterSlug,
        isConsistent: true,
        conditionsAudited: [],
        missingVersions: [],
        missingEmbeddings: [],
        brokenSymlinks: [],
        discrepancies: [],
    }

    if (!charData) {
        auditResult.isConsistent = false
        auditResult.discrepancies.push(
            `CHARACTER_NOT_IN_MANIFEST: [${characterSlug}]`,
        )
    } else {
        const conditions = charData.condition_variants || {}
        for (const condTag of Object.keys(conditions).sort()) {
            const meta = conditions[condTag] || {}
            const versionTag = String(meta.active_version || 'v1')
            const versionNum = parseInt(versionTag.replace(/^v/, ''), 10) || 1
            const expectedFileName = `${characterSlug}_${condTag}_${versionTag}.wav`
            const expectedFilePath = path.join(versionsDir, expectedFileName)

            const symlinkName = `${characterSlug}--${condTag}.wav`
            const symlinkPath = path.join(activeDir, symlinkName)
            const expectedRelativeTarget = path.join(
                '..',
                'versions',
                expectedFileName,
            )

            const expectedEmbeddingName = `${characterSlug}_${condTag}_${versionTag}.pt`
            const expectedEmbeddingPath = path.join(
                embeddingsDir,
                expectedEmbeddingName,
            )

            if (!(await fs.pathExists(expectedFilePath))) {
                auditResult.missingVersions.push(expectedFileName)
                auditResult.isConsistent = false
                await emitConsole(
                    ste,
                    `:: [VAULT:ERR] Missing versioned take: ${expectedFileName}.`,
                )
            } else {
                const stat = await fs.stat(expectedFilePath)
                if ((stat.mode & 0o777) !== 0o444) {
                    auditResult.discrepancies.push(
                        `READ_ONLY_PERM_BREACH: ${expectedFileName} mode is ${(stat.mode & 0o777).toString(8)}, expected 444`,
                    )
                    auditResult.isConsistent = false
                    await emitConsole(
                        ste,
                        `:: [VAULT:ERR] READ_ONLY_PERM_BREACH: versions/${expectedFileName}.`,
                    )
                } else {
                    await emitConsole(
                        ste,
                        `>> [VAULT:OK] versions/${expectedFileName} mode 0444 verified.`,
                    )
                }
            }

            let rawTarget: string | null = null
            try {
                rawTarget = await fs.readlink(symlinkPath)
            } catch {
                rawTarget = null
            }
            if (rawTarget === null) {
                auditResult.brokenSymlinks.push(`${symlinkName} (missing)`)
                auditResult.isConsistent = false
                await emitConsole(
                    ste,
                    `:: [VAULT:ERR] Broken active symlink: ${symlinkName} (target missing).`,
                )
            } else if (rawTarget !== expectedRelativeTarget) {
                auditResult.brokenSymlinks.push(
                    `${symlinkName} -> ${rawTarget} != ${expectedRelativeTarget}`,
                )
                auditResult.isConsistent = false
                await emitConsole(
                    ste,
                    `:: [VAULT:ERR] Active symlink drift: ${symlinkName} -> ${rawTarget}.`,
                )
            } else {
                await emitConsole(
                    ste,
                    `>> [VAULT:OK] active/${symlinkName} -> ${expectedRelativeTarget} verified.`,
                )
            }

            const hasEmbedding = await fs.pathExists(expectedEmbeddingPath)
            if (!hasEmbedding) {
                auditResult.missingEmbeddings.push(expectedEmbeddingName)
                auditResult.isConsistent = false
                await emitConsole(
                    ste,
                    `:: [VAULT:WARN] Missing latent tensor: ${expectedEmbeddingName}.`,
                )
            } else {
                await emitConsole(
                    ste,
                    `>> [VAULT:OK] embeddings/${expectedEmbeddingName} present.`,
                )
            }

            auditResult.conditionsAudited.push({
                conditionTag: condTag,
                activeVersion: versionTag,
                versionNumber: versionNum,
                fileName: expectedFileName,
                symlinkPath,
                targetRelativePath: expectedRelativeTarget,
                sha256: meta.sha256 || 'unknown',
                somaticTrigger: meta.somatic_trigger,
                hasEmbedding,
            })
        }
    }

    const verdict = auditResult.isConsistent ? '[CONSISTENT]' : '[INCONSISTENT]'
    await emitConsole(
        ste,
        `>> [VAULT:AUDIT] Condition vault audit for [${characterSlug}]: ${verdict} (${auditResult.conditionsAudited.length} condition(s)).`,
    )

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'audit-condition-vault',
                val: auditResult.isConsistent ? 0 : 1,
                dat: auditResult,
                src: characterSlug,
            },
        })
    }

    if (strict && !auditResult.isConsistent) {
        throw new Error(
            `CONDITION_VAULT_DRIFT_BREACH: Condition vault for [${characterSlug}] is inconsistent.`,
        )
    }

    return cpy
}
