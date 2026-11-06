import type Compliance from './fce/compliance.interface.js';
import type { AudioProbeResult, SignalGeometryClassification } from './fce/compliance.bit.js';

export class ComplianceModel implements Compliance {
  idx = '24.compliance';
  lastProbeResult: AudioProbeResult | null = null;
  lastClassification: SignalGeometryClassification | null = null;
  complianceStatus: 'UNINSPECTED' | 'COMPLIANT' | 'NEEDS_CONFORMANCE' | 'NON_COMPLIANT' = 'UNINSPECTED';
}

export default ComplianceModel;