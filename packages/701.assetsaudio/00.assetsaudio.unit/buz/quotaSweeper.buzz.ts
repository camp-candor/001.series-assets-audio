import fs from 'fs-extra';
import path from 'path';
import type { AssetsAudioModel } from '../assetsaudio.model.js';
import type AssetsAudioBit from '../fce/assetsaudio.bit.js';
import type { StorageQuotaReport } from '../fce/assetsaudio.bit.js';

export const TRACKED_AUDIO_EXTENSIONS = new Set([
  '.wav',
  '.mp3',
  '.flac',
  '.pt',
  '.json',
]);

export interface DirectoryStatResult {
  totalBytes: number;
  totalFiles: number;
}

export const scanDirectoryRecursive = async (
  dirPath: string,
): Promise<DirectoryStatResult> => {
  if (!(await fs.pathExists(dirPath))) {
    return { totalBytes: 0, totalFiles: 0 };
  }

  let totalBytes = 0;
  let totalFiles = 0;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const sub = await scanDirectoryRecursive(fullPath);
      totalBytes += sub.totalBytes;
      totalFiles += sub.totalFiles;
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TRACKED_AUDIO_EXTENSIONS.has(ext)) {
        const stat = await fs.stat(fullPath);
        totalBytes += stat.size;
        totalFiles += 1;
      }
    }
  }

  return { totalBytes, totalFiles };
};

export const sweepStorageQuotas = async (
  cpy: AssetsAudioModel,
  bal: AssetsAudioBit,
  ste?: any,
): Promise<AssetsAudioModel> => {
  const rootDir = bal?.src || cpy.vaultRoot;
  const subdirs = ['voices', 'foley', 'music'];
  const breakdown: Record<string, { bytes: number; files: number }> = {};

  let aggregateBytes = 0;
  let aggregateFiles = 0;

  for (const sub of subdirs) {
    const targetPath = path.join(rootDir, sub);
    const stats = await scanDirectoryRecursive(targetPath);
    breakdown[sub] = { bytes: stats.totalBytes, files: stats.totalFiles };
    aggregateBytes += stats.totalBytes;
    aggregateFiles += stats.totalFiles;
  }

  const ceiling = (bal?.dat as any)?.quotaCeilingBytes || cpy.quotaCeilingBytes;
  const warning = (bal?.dat as any)?.quotaWarningBytes || cpy.quotaWarningBytes;
  const percentage = Number(((aggregateBytes / ceiling) * 100).toFixed(2));

  let status: 'HEALTHY' | 'APPROACHING_CEILING' | 'EXCEEDED' = 'HEALTHY';
  if (aggregateBytes >= ceiling) {
    status = 'EXCEEDED';
  } else if (aggregateBytes >= warning) {
    status = 'APPROACHING_CEILING';
  }

  const report: StorageQuotaReport = {
    vaultRoot: rootDir,
    totalVaultBytes: aggregateBytes,
    trackedMediaFiles: aggregateFiles,
    quotaCeilingBytes: ceiling,
    quotaWarningBytes: warning,
    percentageUsed: percentage,
    status,
    subdirectories: breakdown,
    timestamp: new Date().toISOString(),
  };

  cpy.totalVaultBytes = aggregateBytes;
  cpy.trackedMediaFiles = aggregateFiles;
  cpy.lastQuotaReport = report;

  if (status === 'EXCEEDED') {
    cpy.vaultHealthStatus = 'QUOTA_EXCEEDED';
    if (ste?.hunt) {
      await ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `:: [SWEEPER:FAIL] STORAGE QUOTA EXCEEDED: ${aggregateBytes} bytes exceeds ceiling of ${ceiling} bytes (${percentage}%).`,
      }).catch(() => {});
    }

    const breachError = new Error(
      `STORAGE_QUOTA_EXCEEDED_BREACH: Total vault size (${aggregateBytes} bytes) exceeds 4 GB limit.`,
    );

    if (bal?.slv) {
      bal.slv({
        asbBit: {
          idx: 'sweep-storage-quotas-fail',
          val: aggregateBytes,
          dat: report,
          src: rootDir,
        },
      });
    }
    throw breachError;
  }

  if (status === 'APPROACHING_CEILING') {
    cpy.vaultHealthStatus = 'DEGRADED';
    if (ste?.hunt) {
      await ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `:: [SWEEPER:WARN] Vault storage approaching ceiling: ${aggregateBytes} / ${ceiling} bytes (${percentage}%).`,
      }).catch(() => {});
    }
  } else {
    cpy.vaultHealthStatus = 'HEALTHY';
    if (ste?.hunt) {
      await ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `>> [SWEEPER] Storage Quota Audit: ${aggregateBytes} bytes across ${aggregateFiles} files (${percentage}% of 4 GB).`,
      }).catch(() => {});
    }
  }

  if (bal?.slv) {
    bal.slv({
      asbBit: {
        idx: 'sweep-storage-quotas',
        val: aggregateBytes,
        dat: report,
        src: rootDir,
      },
    });
  }

  return cpy;
};
