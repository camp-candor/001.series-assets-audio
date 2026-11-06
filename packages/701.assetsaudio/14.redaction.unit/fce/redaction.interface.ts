import type RedactionBit from './redaction.bit.js'
import type { RedactionAuditReport } from './redaction.bit.js'

export default interface Redaction {
    idx: string
    monotoneTargetPitchHz: number
    lpcOrder: number
    lastAuditReport: RedactionAuditReport | null
}
