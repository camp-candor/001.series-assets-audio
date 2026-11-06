export interface AudioTechnicalMetrics {
  lufs: number;
  peakDbtp: number;
  sampleRate: number;
  channels: number;
}

export interface TwoTierPromotionPayload {
  characterSlug: string;
  sourceAudioPath: string;
  targetVersionNumber: number;
  conditionTag?: string;
  operatorId: string;
  technicalMetrics: AudioTechnicalMetrics;
  qualitativeNotes?: string;
}

export interface PromotionReceipt {
  versionedFilePath: string;
  activeSymlinkPath: string;
  embeddingFilePath: string;
  manifestUpdated: boolean;
  changelogAppended: boolean;
  sha256: string;
  timestamp: string;
}
