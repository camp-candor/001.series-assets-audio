import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { AssetsAudioModel } from '../00.assetsaudio.unit/assetsaudio.model.js';
import { sweepStorageQuotas } from '../00.assetsaudio.unit/buz/quotaSweeper.buzz.js';
import { executeMasterAudit } from '../00.assetsaudio.unit/buz/masterAudit.buzz.js';

describe('Asset Vault Orchestrator Domain Unit Tests', () => {
  const testRoot = path.resolve(process.cwd(), '.tmp_test_orchestrator');

  beforeEach(async () => {
    await fs.remove(testRoot);
    await fs.ensureDir(testRoot);
  });

  afterEach(async () => {
    await fs.remove(testRoot);
  });

  it('initializes orchestrator model with default 4 GB storage ceiling', () => {
    const model = new AssetsAudioModel();
    expect(model.idx).toBe('00.assetsaudio');
    expect(model.quotaCeilingBytes).toBe(4294967296);
    expect(model.quotaWarningBytes).toBe(3758096384);
    expect(model.vaultHealthStatus).toBe('UNINITIALIZED');
  });

  it('accurately aggregates recursive physical bytes across vault subdirectories', async () => {
    const model = new AssetsAudioModel();
    model.vaultRoot = testRoot;

    // Create nested mock audio binaries
    const voicesDir = path.join(testRoot, 'voices', 'versions');
    const foleyDir = path.join(testRoot, 'foley', 'impacts');
    await fs.ensureDir(voicesDir);
    await fs.ensureDir(foleyDir);

    const buf1 = Buffer.alloc(2048, 0x01);
    const buf2 = Buffer.alloc(4096, 0x02);
    await fs.writeFile(path.join(voicesDir, 'take1.wav'), buf1);
    await fs.writeFile(path.join(foleyDir, 'hit.wav'), buf2);

    let sweepResult: any = null;
    const bit: any = {
      idx: 'test-sweep',
      src: testRoot,
      slv: (res: any) => {
        sweepResult = res;
      },
    };

    await sweepStorageQuotas(model, bit);

    expect(sweepResult).toBeDefined();
    expect(model.totalVaultBytes).toBe(6144);
    expect(model.trackedMediaFiles).toBe(2);
    expect(model.vaultHealthStatus).toBe('HEALTHY');
  });

  it('detects approaching ceiling warning when storage exceeds 3.5 GB threshold', async () => {
    const model = new AssetsAudioModel();
    model.vaultRoot = testRoot;

    const voicesDir = path.join(testRoot, 'voices');
    await fs.ensureDir(voicesDir);
    await fs.writeFile(path.join(voicesDir, 'sample.wav'), Buffer.alloc(1024));

    let sweepResult: any = null;
    const bit: any = {
      idx: 'test-warning-sweep',
      src: testRoot,
      dat: {
        quotaCeilingBytes: 2000,
        quotaWarningBytes: 500, // Artificially lower threshold to trigger warning
      },
      slv: (res: any) => {
        sweepResult = res;
      },
    };

    await sweepStorageQuotas(model, bit);

    expect(sweepResult).toBeDefined();
    expect(sweepResult.asbBit.dat.status).toBe('APPROACHING_CEILING');
    expect(model.vaultHealthStatus).toBe('DEGRADED');
  });

  it('fails closed and throws breach error when storage exceeds hard ceiling', async () => {
    const model = new AssetsAudioModel();
    model.vaultRoot = testRoot;

    const voicesDir = path.join(testRoot, 'voices');
    await fs.ensureDir(voicesDir);
    await fs.writeFile(path.join(voicesDir, 'large.wav'), Buffer.alloc(5000));

    const bit: any = {
      idx: 'test-breach-sweep',
      src: testRoot,
      dat: {
        quotaCeilingBytes: 4000, // Hard ceiling below file size
      },
    };

    await expect(sweepStorageQuotas(model, bit)).rejects.toThrow(
      'STORAGE_QUOTA_EXCEEDED_BREACH',
    );
    expect(model.vaultHealthStatus).toBe('QUOTA_EXCEEDED');
  });

  it('executes master audit gauntlet and reports aggregate health status', async () => {
    const model = new AssetsAudioModel();
    model.vaultRoot = testRoot;

    // Setup valid sub-vault directories and non-poison file
    const versionsDir = path.join(testRoot, 'voices', 'versions');
    const activeDir = path.join(testRoot, 'voices', 'active');
    const embeddingsDir = path.join(testRoot, 'voices', 'embeddings');
    await fs.ensureDir(versionsDir);
    await fs.ensureDir(activeDir);
    await fs.ensureDir(embeddingsDir);

    await fs.writeFile(path.join(versionsDir, 'sample.wav'), Buffer.alloc(2048, 0xaa));

    let auditResult: any = null;
    const bit: any = {
      idx: 'test-master-audit',
      src: testRoot,
      slv: (res: any) => {
        auditResult = res;
      },
    };

    await executeMasterAudit(model, bit);

    expect(auditResult).toBeDefined();
    expect(auditResult.asbBit.dat.overallStatus).toBe('HEALTHY');
    expect(auditResult.asbBit.dat.subVaultIntegrity.versionsPresent).toBe(true);
    expect(auditResult.asbBit.dat.subVaultIntegrity.activePresent).toBe(true);
    expect(model.vaultHealthStatus).toBe('HEALTHY');
  });
});
