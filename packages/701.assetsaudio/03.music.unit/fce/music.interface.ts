export type MusicStemCategory = 'ambient' | 'score'

export interface MusicStemDefinition {
    stem_id: string
    category: MusicStemCategory
    wav_path: string
    sha256: string
    sample_rate_hz: 48000
    bit_depth: 24
    channels: 1 | 2
    duration_ms: number
    loop_seamless: boolean
    zero_crossing_delta: number
    vocal_band_ceiling_dbfs: number
    recommended_ducking_db: number
    description: string
}

export interface MusicManifest {
    schema_version: '1.0.0'
    series_scope: string
    stems: Record<string, MusicStemDefinition>
}

export interface LoopBoundaryAuditResult {
    valid: boolean
    stemId: string
    firstSampleNormalized: number
    lastSampleNormalized: number
    zeroCrossingDelta: number
    vocalBandCeilingDbfs: number
    statusCode:
        | 'MUSIC_STEM_COMPLIANT'
        | 'LOOP_BOUNDARY_CLICK_BREACH'
        | 'VOCAL_BAND_MASKING_BREACH'
        | 'MUSIC_STEM_UNREGISTERED_BREACH'
        | 'MUSIC_WAV_MISSING_OR_CORRUPT_BREACH'
    message: string
}

export interface MusicManifestValidationResult {
    valid: boolean
    manifestPath: string
    stemsValidated: string[]
    totalStems: number
    breaches: string[]
}

export interface MusicStemResolutionResult {
    valid: boolean
    stemId: string
    stem: MusicStemDefinition | null
    statusCode: LoopBoundaryAuditResult['statusCode']
    message: string
}

export interface MusicRegistrationPayload {
    stemId: string
    wavPath: string
    category?: MusicStemCategory
    description?: string
    vocalBandCeilingDbfs?: number
    recommendedDuckingDb?: number
    seriesScope?: string
}

export default interface Music {
    idx: string
    musicRoot: string
    stemsRegistered: number
    stemsVerified: number
    lastResolutionStatus: string
    lastRegisteredStem: string
}
