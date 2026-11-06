import type VoiceBit from './voice.bit.js'
import type { LegalClearanceRecord } from './legalClearance.interface.js'

export default interface Voice {
    idx: string
    voicesRoot: string
    activeVersionsCount: number
}

export interface WavHeaderInfo {
    isRiffWave: boolean
    audioFormat: number
    channels: number
    sampleRateHz: number
    bitDepth: number
    dataBytes: number
    fileBytes: number
}

export interface VoiceManifestValidationResult {
    valid: boolean
    manifestPath: string
    charactersValidated: string[]
    rosterPending: string[]
    breaches: string[]
}

export interface CharacterVoiceResolution {
    characterId: string
    condition: string
    versionTag: string
    referenceWavPath: string
    referenceWavRelPath: string
    activePointerPath: string
    embeddingPath: string
    sha256: string
    referenceExists: boolean
    embeddingExists: boolean
}

export interface LexiconValidationResult {
    valid: boolean
    lexiconPath: string
    entryCount: number
    missingTerms: string[]
    breaches: string[]
}

export interface ActivePointerCheck {
    pointerName: string
    pointerPath: string
    kind: 'symlink' | 'pointer-file' | 'copy' | 'missing'
    resolvedTarget: string
    expectedTarget: string
    ok: boolean
    code?: 'DANGLING_ACTIVE_VOICE_SYMLINK' | 'ACTIVE_VOICE_SYMLINK_MISMATCH'
}

export interface SymlinkIntegrityReport {
    intact: boolean
    checked: ActivePointerCheck[]
    dangling: string[]
    mismatched: string[]
}

export interface OrphanTakeAuditResult {
    clean: boolean
    scanned: string[]
    referenced: string[]
    orphans: string[]
}

export interface VoiceTakeRegistrationPayload {
    characterSlug: string
    displayName?: string
    versionTag?: string
    sourceWavPath: string
    clearance: Omit<LegalClearanceRecord, 'characterSlug'> &
        Partial<Pick<LegalClearanceRecord, 'characterSlug'>>
}
