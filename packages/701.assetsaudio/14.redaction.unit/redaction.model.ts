import type Redaction from './fce/redaction.interface.js'
import type { RedactionAuditReport } from './fce/redaction.bit.js'

export class RedactionModel implements Redaction {
    idx = '14.redaction'
    monotoneTargetPitchHz = 120.0
    lpcOrder = 16
    lastAuditReport: RedactionAuditReport | null = null
}

export default RedactionModel
