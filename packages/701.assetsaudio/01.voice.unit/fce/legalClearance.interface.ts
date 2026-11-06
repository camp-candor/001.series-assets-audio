export interface LegalClearanceRecord {
    characterSlug: string
    clearanceToken: string
    talentIdentifier: string
    consentVerified: boolean
    signedAtIso: string
    jurisdiction: 'US-GA-WIREGRASS' | 'GLOBAL-STUDIO'
    sha256ConsentDigest: string
}

export type LegalClearanceStatusCode =
    | 'CLEARANCE_VERIFIED'
    | 'LEGAL_CLEARANCE_MISSING_BREACH'
    | 'LEGAL_TOKEN_FORMAT_BREACH'
    | 'TALENT_CONSENT_UNVERIFIED_BREACH'
    | 'CONSENT_DIGEST_MISMATCH_BREACH'

export interface LegalClearanceValidationResult {
    valid: boolean
    characterSlug: string
    clearanceToken: string
    statusCode: LegalClearanceStatusCode
    message: string
}

export interface LexiconEntry {
    word: string
    arpabet: string
    ipa: string
    category:
        'PROPER_NOUN' | 'REGIONAL_DIALECT' | 'CLINICAL_OPTOMETRY' | 'LORE_TERM'
    notes?: string
}

export interface LexiconManifest {
    schema_version: '1.0.0'
    series_scope: string
    entries: Record<string, LexiconEntry>
}
