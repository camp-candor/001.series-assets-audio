import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { relocateVersionedTake } from '../01.voice.unit/buz/versionPromote.buzz.js';
import { generateSpeakerEmbedding } from '../01.voice.unit/buz/embeddingExtract.buzz.js';
import { retargetActiveSymlink } from '../01.voice.unit/buz/symlinkRetarget.buzz.js';
import { commitManifestVersion } from '../01.voice.unit/buz/manifestCommit.buzz.js';
import { appendVersionChangelog } from '../01.voice.unit/buz/changelogAppend.buzz.js';
import { executeTwoTierPromotion } from '../01.voice.unit/buz/twoTierPromote.buzz.js';
import { VoiceModel } from '../01.voice.unit/voice.model.js';
import type { TwoTierPromotionPayload } from '../01.voice.unit/fce/inodeRelocation.interface.js';

describe('Two-Tier Inode Relocation Atomic Swap Feature Tests', () => {
  const testRoot = path.resolve(process.cwd(), '.tmp_test_inode_relocation');

  beforeEach(async () => {
    await fs.remove(testRoot);
    await fs.ensureDir(testRoot);
  });

  afterEach(async () => {
    await fs.remove(testRoot);
  });

  it('relocates take atomically to versions directory and applies mode 0444', async () => {
    const srcFile = path.join(testRoot, 'input_master.wav');
    await fs.writeFile(srcFile, Buffer.alloc(4096, 0x1f));

    const versionsDir = path.join(testRoot, 'voices', 'versions');
    const { finalPath, sha256 } = await relocateVersionedTake(
      srcFile,
      versionsDir,
      'char_bog_v1.wav',
    );

    expect(await fs.pathExists(finalPath)).toBe(true);
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);

    const stat = await fs.stat(finalPath);
    // Mode & 0777 should reflect 0444 (read-only)
    expect(stat.mode & 0o777).toBe(0o444);
  });

  it('extracts 128-dimensional floating point speaker latent vector to embeddings directory', async () => {
    const embeddingsDir = path.join(testRoot, 'voices', 'embeddings');
    const tensorPath = await generateSpeakerEmbedding(
      embeddingsDir,
      'char_bog',
      1,
    );

    expect(await fs.pathExists(tensorPath)).toBe(true);
    const buf = await fs.readFile(tensorPath);
    // 128 float32 values = 512 bytes
    expect(buf.length).toBe(512);
  });

  it('atomically swaps active symlink pointer to versioned target', async () => {
    const activeDir = path.join(testRoot, 'voices', 'active');
    const symlinkPath = await retargetActiveSymlink(
      activeDir,
      'char_bog',
      'char_bog_v2.wav',
    );

    try { await fs.lstat(symlinkPath); } catch (e) { console.error('lstat err', e); throw e; }
    const lstat = await fs.lstat(symlinkPath);
    expect(lstat.isSymbolicLink()).toBe(true);
    const rawTarget = await fs.readlink(symlinkPath);
    expect(rawTarget.replace(/\\/g, '/')).toBe('../versions/char_bog_v2.wav');
  });

  it('commits manifest active version with alphabetically sorted keys', async () => {
    const manifestPath = path.join(testRoot, 'voices', 'voice_manifest.json');
    await commitManifestVersion(manifestPath, 'char_silas', 2, 'dummy-sha-2');
    await commitManifestVersion(manifestPath, 'char_bog', 1, 'dummy-sha-1');

    const content = await fs.readJson(manifestPath);
    expect(content.voices.char_bog.active_version).toBe('v1');
    expect(content.voices.char_silas.active_version).toBe('v2');

    const keys = Object.keys(content.voices);
    expect(keys).toEqual(['char_bog', 'char_silas']);
  });

  it('appends version audit log entry to CHANGELOG.md', async () => {
    const changelogPath = path.join(testRoot, 'voices', 'CHANGELOG.md');
    const payload: TwoTierPromotionPayload = {
      characterSlug: 'char_bog',
      sourceAudioPath: 'input.wav',
      targetVersionNumber: 3,
      operatorId: 'operator_elias',
      technicalMetrics: {
        lufs: -16.0,
        peakDbtp: -1.0,
        sampleRate: 48000,
        channels: 1,
      },
      qualitativeNotes: 'Retake due to gravelly throat resonance.',
    };

    await appendVersionChangelog(changelogPath, payload, 'feedface1234');

    const txt = await fs.readFile(changelogPath, 'utf8');
    expect(txt).toContain('### [v3] - char_bog');
    expect(txt).toContain('feedface1234');
    expect(txt).toContain('-16 LUFS');
    expect(txt).toContain('Retake due to gravelly throat resonance.');
  });

  it('executes full end-to-end two-tier promotion buzzer lifecycle', async () => {
    const model = new VoiceModel();
    model.voicesRoot = testRoot;

    const srcFile = path.join(testRoot, 'conformed_candidate.wav');
    await fs.writeFile(srcFile, Buffer.alloc(2048, 0x5a));

    const payload: TwoTierPromotionPayload = {
      characterSlug: 'char_silas',
      sourceAudioPath: srcFile,
      targetVersionNumber: 1,
      operatorId: 'lead_sound_designer',
      technicalMetrics: {
        lufs: -16.0,
        peakDbtp: -1.0,
        sampleRate: 48000,
        channels: 1,
      },
      qualitativeNotes: 'Approved canonical master take.',
    };

    let slvResult: any = null;
    const bit: any = {
      idx: 'test-promotion',
      dat: payload,
      slv: (res: any) => {
        slvResult = res;
      },
    };

    await executeTwoTierPromotion(model, bit);

    expect(slvResult).toBeDefined();
    expect(slvResult.voiBit.val).toBe(0);

    const receipt = slvResult.voiBit.dat;
    expect(await fs.pathExists(receipt.versionedFilePath)).toBe(true);
    expect(await fs.pathExists(receipt.activeSymlinkPath)).toBe(true);
    expect(await fs.pathExists(receipt.embeddingFilePath)).toBe(true);
    expect(receipt.manifestUpdated).toBe(true);
    expect(receipt.changelogAppended).toBe(true);
  });
});
