export type FoleyCategory = 'impacts' | 'locomotion' | 'handling'

export interface FoleyVariantEntry {
    variant_id: string
    wav_path: string
    sha256: string
    sample_rate_hz: 48000
    bit_depth: 24
    channels: 1 | 2
    duration_ms: number
    peak_dbfs: number
}

export interface FoleyCueDefinition {
    cue_slug: string
    category: FoleyCategory
    description: string
    min_variants_required: number
    variants: FoleyVariantEntry[]
}

export interface FoleyRegistryManifest {
    schema_version: '1.0.0'
    series_scope: string
    cues: Record<string, FoleyCueDefinition>
}

export interface FoleyResolutionResult {
    valid: boolean
    cueSlug: string
    selectedVariantIndex: number
    variant: FoleyVariantEntry | null
    statusCode:
        | 'FOLEY_CUE_RESOLVED'
        | 'FOLEY_CUE_UNREGISTERED_BREACH'
        | 'FOLEY_VARIATION_POOL_STARVATION_BREACH'
        | 'FOLEY_DUPLICATE_VARIANT_HASH_BREACH'
        | 'FOLEY_WAV_MISSING_OR_CORRUPT_BREACH'
    message: string
}

export interface FoleyPoolAuditResult {
    valid: boolean
    cueSlug: string
    variantCount: number
    minVariantsRequired: number
    distinctHashes: number
    breaches: string[]
    checkedVariants: string[]
}

export interface FoleyRegistryValidationResult {
    valid: boolean
    registryPath: string
    cuesValidated: string[]
    totalVariants: number
    breaches: string[]
}

export interface FoleyAssetRegistrationPayload {
    cueSlug: string
    wavPath: string
    category?: FoleyCategory
    description?: string
}

export default interface Foley {
    idx: string
    foleyRoot: string
    cuesRegistered: number
    variantsVerified: number
    lastResolutionStatus: string
}
