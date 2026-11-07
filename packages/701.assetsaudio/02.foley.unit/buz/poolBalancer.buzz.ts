import { createHash } from 'crypto'
import fs from 'fs-extra'
import path from 'path'
import type {
    FoleyCueDefinition,
    FoleyPoolAuditResult,
    FoleyVariantEntry,
} from '../fce/foley.interface.js'

export const FOLEY_MIN_VARIANTS = 3
export const FOLEY_MIN_WAV_BYTES = 1024

const SHA256_PATTERN = /^[a-f0-9]{64}$/

export const normalizeFoleyCueSlug = (raw: unknown): string => {
    let slug = String(raw ?? '').trim()
    slug = slug.replace(/^foley:\/\/[^/]*\//i, '')
    slug = slug.replace(/^foley:\/\//i, '')
    return slug.trim().toLowerCase()
}

export const deterministicHash = (input: string): bigint => {
    const digest = createHash('sha256').update(input).digest()
    return digest.readBigUInt64BE(0)
}

export const sha256FileSync = (filePath: string): string =>
    createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

export const resolveVariantPath = (
    repoRoot: string,
    variant: FoleyVariantEntry,
): string =>
    path.isAbsolute(variant.wav_path)
        ? variant.wav_path
        : path.join(repoRoot, variant.wav_path)

export const auditVariationPoolDepth = (
    cue: FoleyCueDefinition,
    repoRoot: string,
): FoleyPoolAuditResult => {
    const breaches: string[] = []
    const variants = Array.isArray(cue?.variants) ? cue.variants : []
    const checkedVariants: string[] = []
    const minRequired = cue?.min_variants_required ?? FOLEY_MIN_VARIANTS

    if (variants.length < Math.max(minRequired, FOLEY_MIN_VARIANTS)) {
        breaches.push(
            `FOLEY_VARIATION_POOL_STARVATION_BREACH: [${cue?.cue_slug}] declares ${variants.length} variants, minimum ${Math.max(minRequired, FOLEY_MIN_VARIANTS)} required.`,
        )
    }

    const hashes = new Set<string>()
    const seenVariantIds = new Set<string>()
    for (const variant of variants) {
        const label = variant?.variant_id || variant?.wav_path || '<unknown>'
        checkedVariants.push(label)
        if (!variant?.variant_id || seenVariantIds.has(variant.variant_id)) {
            breaches.push(
                `FOLEY_DUPLICATE_VARIANT_HASH_BREACH: [${cue?.cue_slug}] duplicate or missing variant_id [${label}].`,
            )
        }
        seenVariantIds.add(String(variant?.variant_id))

        const declaredHash = String(variant?.sha256 || '').toLowerCase()
        if (!SHA256_PATTERN.test(declaredHash)) {
            breaches.push(
                `FOLEY_WAV_MISSING_OR_CORRUPT_BREACH: [${cue?.cue_slug}/${label}] sha256 is not a lowercase 64-char hex digest.`,
            )
        } else if (hashes.has(declaredHash)) {
            breaches.push(
                `FOLEY_DUPLICATE_VARIANT_HASH_BREACH: [${cue?.cue_slug}] variants share sha256 [${declaredHash.slice(0, 12)}...].`,
            )
        }
        hashes.add(declaredHash)

        const variantPath = resolveVariantPath(repoRoot, variant as any)
        if (!(variant?.wav_path && fs.existsSync(variantPath))) {
            breaches.push(
                `FOLEY_WAV_MISSING_OR_CORRUPT_BREACH: [${cue?.cue_slug}/${label}] missing physical WAV at [${variant?.wav_path}].`,
            )
            continue
        }
        const stat = fs.statSync(variantPath)
        if (!stat.isFile() || stat.size <= FOLEY_MIN_WAV_BYTES) {
            breaches.push(
                `FOLEY_WAV_MISSING_OR_CORRUPT_BREACH: [${cue?.cue_slug}/${label}] WAV is ${stat.size} bytes, minimum ${FOLEY_MIN_WAV_BYTES} required.`,
            )
            continue
        }
        const actualHash = sha256FileSync(variantPath)
        if (actualHash !== declaredHash) {
            breaches.push(
                `FOLEY_WAV_MISSING_OR_CORRUPT_BREACH: [${cue?.cue_slug}/${label}] on-disk SHA-256 [${actualHash.slice(0, 12)}...] does not match registry [${declaredHash.slice(0, 12)}...].`,
            )
        }
    }

    return {
        valid: breaches.length === 0,
        cueSlug: String(cue?.cue_slug || ''),
        variantCount: variants.length,
        minVariantsRequired: Math.max(minRequired, FOLEY_MIN_VARIANTS),
        distinctHashes: hashes.size,
        breaches,
        checkedVariants,
    }
}

export const auditVariationPoolDepthOrThrow = (
    cue: FoleyCueDefinition,
    repoRoot: string,
): FoleyPoolAuditResult => {
    const result = auditVariationPoolDepth(cue, repoRoot)
    if (!result.valid) {
        const code = result.breaches[0].split(':')[0]
        throw new Error(`${code}: ${result.breaches.join(' | ')}`)
    }
    return result
}

export const selectDeterministicFoleyVariant = (
    cue: FoleyCueDefinition,
    seedKey: string,
    previousVariantIndex?: number,
): number => {
    const length = Array.isArray(cue?.variants) ? cue.variants.length : 0
    if (length === 0) return 0
    const digest = deterministicHash(`${seedKey}:${cue.cue_slug}:${length}`)
    let index = Number(digest % BigInt(length))
    if (
        typeof previousVariantIndex === 'number' &&
        length > 1 &&
        index === previousVariantIndex
    ) {
        index = (index + 1) % length
    }
    return index
}
