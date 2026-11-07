import fs from 'fs-extra'
import path from 'path'
import type { FoleyModel } from '../foley.model.js'
import type FoleyBit from '../fce/foley.bit.js'
import type {
    FoleyCategory,
    FoleyCueDefinition,
    FoleyRegistryManifest,
    FoleyRegistryValidationResult,
    FoleyResolutionResult,
    FoleyVariantEntry,
} from '../fce/foley.interface.js'
import {
    FOLEY_MIN_VARIANTS,
    FOLEY_MIN_WAV_BYTES,
    auditVariationPoolDepth,
    normalizeFoleyCueSlug,
    resolveVariantPath,
    selectDeterministicFoleyVariant,
    sha256FileSync,
} from './poolBalancer.buzz.js'

export { initFoley } from './foleyRegistry.buzz.js'
export {
    auditVariationPoolDepth,
    auditVariationPoolDepthOrThrow,
    normalizeFoleyCueSlug,
    selectDeterministicFoleyVariant,
} from './poolBalancer.buzz.js'

const REQUIRED_SAMPLE_RATE_HZ = 48000
const REQUIRED_BIT_DEPTH = 24

const MODULE_REPO_ROOT =
    typeof __dirname !== 'undefined'
        ? path.resolve(__dirname, '..', '..', '..', '..')
        : process.cwd()

const emitConsole = async (ste: any, src: string): Promise<void> => {
    if (!ste?.hunt) return
    await ste
        .hunt('[Console action] Update Console', { idx: 'cns00', src })
        .catch(() => {})
}

const foleyRootOf = (cpy: FoleyModel, bal?: FoleyBit): string => {
    const dat: any = bal?.dat || {}
    return path.resolve(dat.foleyRoot || cpy?.foleyRoot || MODULE_REPO_ROOT)
}

export const registryPathOf = (repoRoot: string): string =>
    path.join(repoRoot, 'foley', 'registry.json')

export const loadFoleyRegistry = async (
    repoRoot: string,
): Promise<FoleyRegistryManifest> => {
    const registryPath = registryPathOf(repoRoot)
    if (!(await fs.pathExists(registryPath))) {
        throw new Error(
            `FOLEY_REGISTRY_MISSING_BREACH: no foley registry at [${registryPath}].`,
        )
    }
    const manifest = (await fs.readJson(registryPath)) as FoleyRegistryManifest
    if (!manifest || typeof manifest !== 'object' || !manifest.cues) {
        throw new Error(
            `FOLEY_REGISTRY_MISSING_BREACH: [${registryPath}] is not a valid foley registry manifest.`,
        )
    }
    return manifest
}

const writeRegistryAtomic = async (
    registryPath: string,
    manifest: FoleyRegistryManifest,
): Promise<void> => {
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const tmpPath = path.join(
        path.dirname(registryPath),
        `.tmp_foley_registry_${nonce}.json`,
    )
    await fs.writeJson(tmpPath, manifest, { spaces: 4 })
    await fs.rename(tmpPath, registryPath)
}

const result = (
    valid: boolean,
    cueSlug: string,
    selectedVariantIndex: number,
    variant: FoleyVariantEntry | null,
    statusCode: FoleyResolutionResult['statusCode'],
    message: string,
): FoleyResolutionResult => ({
    valid,
    cueSlug,
    selectedVariantIndex,
    variant,
    statusCode,
    message,
})

export const resolveFoleyCueSlug = (
    manifest: FoleyRegistryManifest,
    rawSlug: unknown,
): FoleyCueDefinition | null => {
    const slug = normalizeFoleyCueSlug(rawSlug)
    if (!slug) return null
    const direct = manifest.cues?.[slug]
    if (direct) return direct
    for (const cue of Object.values(manifest.cues || {})) {
        if (normalizeFoleyCueSlug(cue?.cue_slug) === slug) return cue
    }
    return null
}

export const validateFoleyRegistry = async (
    cpy: FoleyModel,
    bal: FoleyBit,
    ste?: any,
): Promise<FoleyModel> => {
    const repoRoot = foleyRootOf(cpy, bal)
    const manifest = await loadFoleyRegistry(repoRoot)
    const cues = Object.values(manifest.cues || {})
    const breaches: string[] = []
    const cuesValidated: string[] = []
    let totalVariants = 0

    for (const cue of cues) {
        const audit = auditVariationPoolDepth(cue, repoRoot)
        totalVariants += audit.variantCount
        if (audit.valid) {
            cuesValidated.push(cue.cue_slug)
        } else {
            breaches.push(...audit.breaches)
        }
    }

    const validation: FoleyRegistryValidationResult = {
        valid: breaches.length === 0,
        registryPath: registryPathOf(repoRoot),
        cuesValidated,
        totalVariants,
        breaches,
    }

    if (validation.valid) {
        cpy.cuesRegistered = cuesValidated.length
        cpy.variantsVerified = totalVariants
        await emitConsole(
            ste,
            `>> [FOLEY:REGISTRY:OK] Verified ${cuesValidated.length} cues (${totalVariants} physical WAV variants)`,
        )
    } else {
        await emitConsole(
            ste,
            `>> [FOLEY:REGISTRY:HALT] ${breaches[0] || 'FOLEY_REGISTRY_BREACH'}`,
        )
    }

    if (bal?.slv) {
        bal.slv({
            foleyBit: {
                idx: 'validate-foley-registry',
                val: validation.valid ? 0 : -1,
                dat: validation,
                src: validation.registryPath,
            },
        })
    }

    if (!validation.valid) {
        throw new Error(breaches.join(' | '))
    }

    return cpy
}

export const verifyVariationPools = async (
    cpy: FoleyModel,
    bal: FoleyBit,
    ste?: any,
): Promise<FoleyModel> => {
    const repoRoot = foleyRootOf(cpy, bal)
    const manifest = await loadFoleyRegistry(repoRoot)
    const breaches: string[] = []
    let poolsChecked = 0

    for (const cue of Object.values(manifest.cues || {})) {
        const audit = auditVariationPoolDepth(cue, repoRoot)
        poolsChecked += 1
        if (!audit.valid) breaches.push(...audit.breaches)
    }

    if (breaches.length > 0) {
        await emitConsole(ste, `>> [FOLEY:POOLS:HALT] ${breaches[0]}`)
        if (bal?.slv) {
            bal.slv({
                foleyBit: {
                    idx: 'verify-variation-pools',
                    val: -1,
                    dat: { valid: false, poolsChecked, breaches },
                },
            })
        }
        throw new Error(breaches.join(' | '))
    }

    await emitConsole(
        ste,
        `>> [FOLEY:POOLS:OK] Verified ${poolsChecked} variation pools (>= ${FOLEY_MIN_VARIANTS} distinct variants each)`,
    )
    if (bal?.slv) {
        bal.slv({
            foleyBit: {
                idx: 'verify-variation-pools',
                val: 0,
                dat: { valid: true, poolsChecked, breaches: [] },
            },
        })
    }
    return cpy
}

export const resolveFoleyCue = async (
    cpy: FoleyModel,
    bal: FoleyBit,
    ste?: any,
): Promise<FoleyModel> => {
    const repoRoot = foleyRootOf(cpy, bal)
    const dat: any = bal?.dat || {}
    const rawCue = dat.cueSlug ?? dat.cue ?? dat.src ?? bal?.src
    const cueSlug = normalizeFoleyCueSlug(rawCue)
    const manifest = await loadFoleyRegistry(repoRoot)
    const cue = resolveFoleyCueSlug(manifest, rawCue)

    let resolution: FoleyResolutionResult
    if (!cue) {
        resolution = result(
            false,
            cueSlug,
            -1,
            null,
            'FOLEY_CUE_UNREGISTERED_BREACH',
            `Foley cue [${cueSlug || String(rawCue)}] is not registered in foley/registry.json.`,
        )
    } else {
        const audit = auditVariationPoolDepth(cue, repoRoot)
        if (!audit.valid) {
            const code = audit.breaches[0].split(':')[0] as
                | 'FOLEY_VARIATION_POOL_STARVATION_BREACH'
                | 'FOLEY_DUPLICATE_VARIANT_HASH_BREACH'
                | 'FOLEY_WAV_MISSING_OR_CORRUPT_BREACH'
            resolution = result(
                false,
                cue.cue_slug,
                -1,
                null,
                code,
                audit.breaches.join(' | '),
            )
        } else {
            const sceneId = String(dat.sceneId ?? dat.scene ?? 'default')
            const beatIndex = Number(dat.beatIndex ?? dat.beat ?? 0)
            const seedKey =
                typeof dat.seedKey === 'string' && dat.seedKey.length > 0
                    ? dat.seedKey
                    : `${sceneId}:${beatIndex}:${cue.cue_slug}`
            const selectedVariantIndex = selectDeterministicFoleyVariant(
                cue,
                seedKey,
                typeof dat.previousVariantIndex === 'number'
                    ? dat.previousVariantIndex
                    : undefined,
            )
            const variant = cue.variants[selectedVariantIndex] || null
            resolution = result(
                true,
                cue.cue_slug,
                selectedVariantIndex,
                variant,
                'FOLEY_CUE_RESOLVED',
                `Foley cue [${cue.cue_slug}] resolved to variant [${variant?.variant_id}] (${seedKey}).`,
            )
        }
    }

    cpy.lastResolutionStatus = resolution.statusCode
    if (resolution.valid) {
        cpy.variantsVerified += 1
        await emitConsole(
            ste,
            `>> [FOLEY:RESOLVE] ${resolution.cueSlug} -> ${resolution.variant?.variant_id} (${resolution.variant?.wav_path})`,
        )
    } else {
        await emitConsole(
            ste,
            `>> [FOLEY:HALT] ${resolution.statusCode}: ${resolution.message}`,
        )
    }

    if (bal?.slv) {
        bal.slv({
            foleyBit: {
                idx: 'resolve-foley-cue',
                val: resolution.valid ? 0 : -1,
                dat: resolution,
                src: resolution.statusCode,
            },
        })
    }

    if (!resolution.valid) {
        throw new Error(`${resolution.statusCode}: ${resolution.message}`)
    }

    return cpy
}

interface FoleyWavInspection {
    valid: boolean
    sampleRateHz: number
    bitDepth: number
    channels: number
    dataBytes: number
    fileBytes: number
    breaches: string[]
}

export const inspectFoleyWav = (filePath: string): FoleyWavInspection => {
    const breaches: string[] = []
    const inspection: FoleyWavInspection = {
        valid: false,
        sampleRateHz: 0,
        bitDepth: 0,
        channels: 0,
        dataBytes: 0,
        fileBytes: 0,
        breaches,
    }
    let buf: Buffer
    try {
        buf = fs.readFileSync(filePath)
    } catch {
        breaches.push(`unreadable file [${filePath}]`)
        return inspection
    }
    inspection.fileBytes = buf.length
    if (buf.length <= FOLEY_MIN_WAV_BYTES) {
        breaches.push(
            `file is ${buf.length} bytes, minimum ${FOLEY_MIN_WAV_BYTES} required`,
        )
        return inspection
    }
    if (
        buf.length < 44 ||
        buf.toString('ascii', 0, 4) !== 'RIFF' ||
        buf.toString('ascii', 8, 12) !== 'WAVE'
    ) {
        breaches.push('missing RIFF/WAVE header')
        return inspection
    }
    let offset = 12
    let audioFormat = 0
    let foundFmt = false
    let foundData = false
    while (offset + 8 <= buf.length) {
        const chunkId = buf.toString('ascii', offset, offset + 4)
        const chunkSize = buf.readUInt32LE(offset + 4)
        const body = offset + 8
        if (chunkId === 'fmt ' && chunkSize >= 16 && body + 16 <= buf.length) {
            audioFormat = buf.readUInt16LE(body)
            inspection.channels = buf.readUInt16LE(body + 2)
            inspection.sampleRateHz = buf.readUInt32LE(body + 4)
            inspection.bitDepth = buf.readUInt16LE(body + 14)
            foundFmt = true
        } else if (chunkId === 'data') {
            inspection.dataBytes = chunkSize
            foundData = true
        }
        offset = body + chunkSize + (chunkSize % 2)
    }
    if (!foundFmt) breaches.push('missing fmt chunk')
    if (!foundData) breaches.push('missing data chunk')
    if (audioFormat !== 1)
        breaches.push(`audioFormat ${audioFormat} != 1 (PCM)`)
    if (inspection.sampleRateHz !== REQUIRED_SAMPLE_RATE_HZ) {
        breaches.push(
            `sampleRate ${inspection.sampleRateHz} != ${REQUIRED_SAMPLE_RATE_HZ}`,
        )
    }
    if (inspection.bitDepth !== REQUIRED_BIT_DEPTH) {
        breaches.push(
            `bitDepth ${inspection.bitDepth} != ${REQUIRED_BIT_DEPTH}`,
        )
    }
    if (inspection.channels !== 1 && inspection.channels !== 2) {
        breaches.push(`channels ${inspection.channels} not mono/stereo`)
    }
    inspection.valid = breaches.length === 0
    return inspection
}

export const registerFoleyAsset = async (
    cpy: FoleyModel,
    bal: FoleyBit,
    ste?: any,
): Promise<FoleyModel> => {
    const repoRoot = foleyRootOf(cpy, bal)
    const dat: any = bal?.dat || {}
    const cueSlug = normalizeFoleyCueSlug(dat.cueSlug ?? dat.cue)
    const wavPathInput = String(dat.wavPath ?? dat.src ?? '')
    if (!cueSlug || !wavPathInput) {
        throw new Error(
            'FOLEY_REGISTER_PAYLOAD_BREACH: registerFoleyAsset requires dat.cueSlug and dat.wavPath.',
        )
    }
    const absoluteWavPath = path.isAbsolute(wavPathInput)
        ? wavPathInput
        : path.resolve(repoRoot, wavPathInput)
    const inspection = inspectFoleyWav(absoluteWavPath)
    if (!inspection.valid) {
        const message = `FOLEY_WAV_MISSING_OR_CORRUPT_BREACH: [${cueSlug}] ${inspection.breaches.join('; ')}.`
        await emitConsole(ste, `>> [FOLEY:REGISTER:HALT] ${message}`)
        if (bal?.slv) {
            bal.slv({
                foleyBit: {
                    idx: 'register-foley-asset',
                    val: -1,
                    dat: { valid: false, breaches: inspection.breaches },
                    src: 'FOLEY_WAV_MISSING_OR_CORRUPT_BREACH',
                },
            })
        }
        throw new Error(message)
    }

    const manifest = await loadFoleyRegistry(repoRoot)
    const category = (dat.category as FoleyCategory) || 'handling'
    let cue = manifest.cues[cueSlug]
    if (!cue) {
        cue = {
            cue_slug: cueSlug,
            category,
            description: String(dat.description || `Foley cue [${cueSlug}]`),
            min_variants_required: FOLEY_MIN_VARIANTS,
            variants: [],
        }
        manifest.cues[cueSlug] = cue
    }

    const variantIndex = cue.variants.length + 1
    const relWavPath = path
        .relative(repoRoot, absoluteWavPath)
        .split(path.sep)
        .join('/')
    const sha256 = sha256FileSync(absoluteWavPath)
    const durationMs = Math.max(
        1,
        Math.round(
            (inspection.dataBytes / (inspection.sampleRateHz * 3)) * 1000,
        ),
    )
    const variant: FoleyVariantEntry = {
        variant_id: `${cueSlug}_${String(variantIndex).padStart(2, '0')}`,
        wav_path: relWavPath,
        sha256,
        sample_rate_hz: REQUIRED_SAMPLE_RATE_HZ as 48000,
        bit_depth: REQUIRED_BIT_DEPTH as 24,
        channels: inspection.channels === 2 ? 2 : 1,
        duration_ms: durationMs,
        peak_dbfs: Number(dat.peakDbfs ?? -6.0),
    }
    cue.variants.push(variant)
    await writeRegistryAtomic(registryPathOf(repoRoot), manifest)

    await emitConsole(
        ste,
        `>> [FOLEY:REGISTER] ${cueSlug} variant [${variant.variant_id}] (${relWavPath})`,
    )
    if (bal?.slv) {
        bal.slv({
            foleyBit: {
                idx: 'register-foley-asset',
                val: cue.variants.length,
                dat: { cueSlug, variant, variantCount: cue.variants.length },
                src: relWavPath,
            },
        })
    }
    return cpy
}

export const updateFoley = async (
    cpy: FoleyModel,
    bal: FoleyBit,
    ste?: any,
): Promise<FoleyModel> => {
    const dat: any = bal?.dat || {}
    if (typeof dat.cuesRegistered === 'number')
        cpy.cuesRegistered = dat.cuesRegistered
    if (typeof dat.variantsVerified === 'number')
        cpy.variantsVerified = dat.variantsVerified
    if (typeof dat.lastResolutionStatus === 'string')
        cpy.lastResolutionStatus = dat.lastResolutionStatus
    if (bal?.slv) {
        bal.slv({
            foleyBit: {
                idx: 'update-foley',
                val: 0,
                dat: {
                    cuesRegistered: cpy.cuesRegistered,
                    variantsVerified: cpy.variantsVerified,
                    lastResolutionStatus: cpy.lastResolutionStatus,
                },
            },
        })
    }
    return cpy
}
