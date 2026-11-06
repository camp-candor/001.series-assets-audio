export interface AudioProbeResult {
  filePath: string;
  containerFormat: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  codecName: string;
  bitRate: number;
  rawFfprobeJson?: any;
}

export interface SignalGeometryClassification {
  category: 'LINEAR_PCM' | 'LOSSLESS_COMPRESSED' | 'LOSSY_STREAM' | 'TENSOR_EMBEDDING' | 'UNKNOWN';
  isBroadcastCompliantGeometry: boolean;
  geometryIssues: string[];
  recommendation: 'READY_FOR_VAULT' | 'NEEDS_CONFORMANCE' | 'REJECT';
  probeDetails: AudioProbeResult;
}

export default interface ComplianceBit<TDat = unknown, TLst = string> {
  idx: string;
  src?: string;
  lst?: TLst[];
  val?: number;
  dat?: TDat;
  slv?: (result: { cmpBit: Partial<ComplianceBit<TDat, TLst>> }) => void;
}
