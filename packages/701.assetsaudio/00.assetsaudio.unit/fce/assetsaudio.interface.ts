import type AssetsAudioBit from './assetsaudio.bit.js';
import type { StorageQuotaReport, MasterAuditReport } from './assetsaudio.bit.js';

export default interface AssetsAudio {
  idx: string;
  vaultRoot: string;
  lfsInitialized: boolean;
  totalVaultBytes: number;
  trackedMediaFiles: number;
  quotaCeilingBytes: number;
  quotaWarningBytes: number;
  lastQuotaReport: StorageQuotaReport | null;
  vaultHealthStatus: 'HEALTHY' | 'DEGRADED' | 'QUOTA_EXCEEDED' | 'UNINITIALIZED';
}
