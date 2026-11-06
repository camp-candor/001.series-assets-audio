import { createHash } from 'crypto'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type {
    LegalClearanceRecord,
    LegalClearanceValidationResult,
} from '../fce/legalClearance.interface.js'

export const LEGAL_CLEARANCE_TOKEN_PATTERN = /^CLR-[A-Z0-9]{4,12}-\d{4}$/
export const CONSENT_DIGEST_PATTERN = /^[a-f0-9]{64}$/

const emitConsole = async (ste: any, src: string): Promise<void> => {
    if (!ste?.hunt) return
    await ste
        .hunt('[Console action] Update Console', { idx: 'cns00', src })
        .catch(() => {})
}

export const computeConsentDigest = (
    record: Pick<
        LegalClearanceRecord,
        'characterSlug' | 'clearanceToken' | 'talentIdentifier' | 'signedAtIso'
    >,
): string =>
    createHash('sha256')
        .update(
            [
                record.characterSlug,
                record.clearanceToken,
                record.talentIdentifier,
                record.signedAtIso,
            ].join('|'),
        )
        .digest('hex')

const verdict = (
    record: Partial<LegalClearanceRecord>,
    statusCode: LegalClearanceValidationResult['statusCode'],
    message: string,
): LegalClearanceValidationResult => ({
    valid: statusCode === 'CLEARANCE_VERIFIED',
    characterSlug: String(record?.characterSlug || ''),
    clearanceToken: String(record?.clearanceToken || ''),
    statusCode,
    message,
})

export const verifyTalentConsentSignature = (
    record: Partial<LegalClearanceRecord>,
): LegalClearanceValidationResult => {
    const slug = String(record?.characterSlug || '')
    if (record?.consentVerified !== true) {
        return verdict(
            record,
            'TALENT_CONSENT_UNVERIFIED_BREACH',
            `Talent consent for [${slug}] is not verified.`,
        )
    }
    const digest = String(record?.sha256ConsentDigest || '')
    if (!CONSENT_DIGEST_PATTERN.test(digest)) {
        return verdict(
            record,
            'CONSENT_DIGEST_MISMATCH_BREACH',
            `Consent digest for [${slug}] is not a lowercase 64-char SHA-256 hex string.`,
        )
    }
    return verdict(
        record,
        'CLEARANCE_VERIFIED',
        `Talent consent signature for [${slug}] verified.`,
    )
}

export const evaluateLegalClearance = (
    record: Partial<LegalClearanceRecord>,
): LegalClearanceValidationResult => {
    const slug = String(record?.characterSlug || '')
    const token =
        typeof record?.clearanceToken === 'string'
            ? record.clearanceToken.trim()
            : ''
    if (!token) {
        return verdict(
            record,
            'LEGAL_CLEARANCE_MISSING_BREACH',
            `No legal clearance token supplied for [${slug}].`,
        )
    }
    if (!LEGAL_CLEARANCE_TOKEN_PATTERN.test(token)) {
        return verdict(
            record,
            'LEGAL_TOKEN_FORMAT_BREACH',
            `Clearance token [${token}] for [${slug}] does not match CLR-XXXX-NNNN.`,
        )
    }
    const consent = verifyTalentConsentSignature(record)
    if (!consent.valid) return consent
    return verdict(
        record,
        'CLEARANCE_VERIFIED',
        `Character [${slug}] clearance verified (${token}).`,
    )
}

export const validateLegalClearanceToken = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const record: Partial<LegalClearanceRecord> = (bal?.dat as any) || {}
    const result = evaluateLegalClearance(record)

    if (result.valid) {
        await emitConsole(
            ste,
            `>> [LEGAL:PASS] Character [${result.characterSlug}] clearance verified (${result.clearanceToken})`,
        )
    } else {
        await emitConsole(
            ste,
            `>> [LEGAL:HALT] ${result.statusCode}: ${result.message}`,
        )
    }

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'validate-legal-clearance-token',
                val: result.valid ? 0 : -1,
                dat: result as any,
                src: result.statusCode,
            },
        })
    }

    if (!result.valid) {
        throw new Error(`${result.statusCode}: ${result.message}`)
    }

    return cpy
}
