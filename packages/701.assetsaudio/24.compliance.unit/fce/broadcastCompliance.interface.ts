export interface EbuLoudnessMetrics {
  integratedLufs: number;
  loudnessRangeLu: number;
  truePeakDbtp: number;
  noiseFloorDbfs: number;
}

export interface BroadcastComplianceReport {
  filePath: string;
  isCompliant: boolean;
  targetStandard: 'WEB_STREAMING_LUFS16' | 'BROADCAST_EBU_R128_LUFS23' | 'BROADCAST_ATSC_A85_LKFS24';
  metrics: EbuLoudnessMetrics;
  issues: string[];
  normalizedGainAppliedDb: number;
  status: 'PASSED' | 'FAILED';
  error?: string;
}
