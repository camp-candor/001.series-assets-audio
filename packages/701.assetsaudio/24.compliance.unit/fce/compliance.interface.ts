import type ComplianceBit from './compliance.bit.js'
import type {
    AudioProbeResult,
    SignalGeometryClassification,
} from './compliance.bit.js'

export default interface Compliance {
    idx: string
    lastProbeResult: AudioProbeResult | null
    lastClassification: SignalGeometryClassification | null
    complianceStatus:
        'UNINSPECTED' | 'COMPLIANT' | 'NEEDS_CONFORMANCE' | 'NON_COMPLIANT'
}
