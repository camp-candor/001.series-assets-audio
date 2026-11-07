export interface Env {
    DB: any
    AUDIO_VAULT_BUCKET: any
    AUDIO_LEASE_DO: any
    MAX_R2_QUOTA_BYTES?: string
    ADMIN_BEARER_TOKEN?: string
}

export interface EdgeAssetRecord {
    asset_id: string
    domain: 'voice' | 'foley' | 'music'
    character_or_cue_slug: string
    version_number: number
    sha256: string
    byte_size: number
    sample_rate_hz: 48000
    bit_depth: 24
    legal_clearance_token: string
    r2_object_key: string
    created_at_iso: string
}
