export interface VoiceScaffoldResult {
  versionsDir: string;
  activeDir: string;
  embeddingsDir: string;
  createdDirs: string[];
}

export interface SymlinkSyncReceipt {
  characterId: string;
  activeSymlinkPath: string;
  targetVersionPath: string;
  versionTag: string;
  isResolved: boolean;
}

export interface SeriesPartitionConfig {
  seriesSlug: string;
  partitionRoot: string;
  lexiconPath: string;
  manifestPath: string;
}

export default interface VoiceBit<TDat = unknown, TLst = string> {
  idx: string;
  src?: string;
  lst?: TLst[];
  val?: number;
  dat?: TDat;
  slv?: (result: { voiBit: Partial<VoiceBit<TDat, TLst>> }) => void;
}
