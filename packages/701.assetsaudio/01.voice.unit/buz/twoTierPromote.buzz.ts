import path from 'path';
import type { VoiceModel } from '../voice.model.js';
import type VoiceBit from '../fce/voice.bit.js';
import type {
  TwoTierPromotionPayload,
  PromotionReceipt,
} from '../fce/inodeRelocation.interface.js';
import { relocateVersionedTake } from './versionPromote.buzz.js';
import { generateSpeakerEmbedding } from './embeddingExtract.buzz.js';
import { retargetActiveSymlink } from './symlinkRetarget.buzz.js';
import { commitManifestVersion } from './manifestCommit.buzz.js';
import { appendVersionChangelog } from './changelogAppend.buzz.js';

export const executeTwoTierPromotion = async (
  cpy: VoiceModel,
  bal: VoiceBit,
  ste?: any,
): Promise<VoiceModel> => {
  const payload: TwoTierPromotionPayload = (bal?.dat as any) || {};

  if (!payload.characterSlug || !payload.sourceAudioPath || !payload.targetVersionNumber) {
    const errorMsg = 'PROMOTION_PAYLOAD_INCOMPLETE: characterSlug, sourceAudioPath, and targetVersionNumber required.';
    const err = new Error(errorMsg);
    if (bal?.slv) {
      bal.slv({ voiBit: { idx: 'execute-two-tier-promotion-fail', val: -1 } });
    }
    throw err;
  }

  const rootDir = cpy.voicesRoot || process.cwd();
  const voicesBase = path.resolve(rootDir, 'voices');
  const versionsDir = path.join(voicesBase, 'versions');
  const activeDir = path.join(voicesBase, 'active');
  const embeddingsDir = path.join(voicesBase, 'embeddings');
  const manifestPath = path.join(voicesBase, 'voice_manifest.json');
  const changelogPath = path.join(voicesBase, 'CHANGELOG.md');

  const fileName = payload.conditionTag
    ? `${payload.characterSlug}_${payload.conditionTag}_v${payload.targetVersionNumber}.wav`
    : `${payload.characterSlug}_v${payload.targetVersionNumber}.wav`;

  // Step 1: Relocate conformed take with mode 0444
  const { finalPath: versionedFilePath, sha256 } = await relocateVersionedTake(
    payload.sourceAudioPath,
    versionsDir,
    fileName,
  );

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [RELOCATE] Relocated conformed take to ${fileName} with mode 0444.`,
    }).catch(() => {});
  }

  // Step 2: Extract speaker latent tensor
  const embeddingFilePath = await generateSpeakerEmbedding(
    embeddingsDir,
    payload.characterSlug,
    payload.targetVersionNumber,
    payload.conditionTag,
  );

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [EMBEDDING] Extracted 128-d speaker latent tensor for ${payload.characterSlug}.`,
    }).catch(() => {});
  }

  // Step 3: Atomic symlink retarget
  const activeSymlinkPath = await retargetActiveSymlink(
    activeDir,
    payload.characterSlug,
    fileName,
    payload.conditionTag,
  );

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [SYMLINK] Atomically swapped active pointer -> ${path.basename(activeSymlinkPath)}.`,
    }).catch(() => {});
  }

  // Step 4: Commit manifest version
  const manifestUpdated = await commitManifestVersion(
    manifestPath,
    payload.characterSlug,
    payload.targetVersionNumber,
    sha256,
    payload.conditionTag,
  );

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [MANIFEST] Committed updated active version to voice_manifest.json.`,
    }).catch(() => {});
  }

  // Step 5: Append changelog
  const changelogAppended = await appendVersionChangelog(
    changelogPath,
    payload,
    sha256,
  );

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [CHANGELOG] Inscribed version audit log to CHANGELOG.md.`,
    }).catch(() => {});
  }

  const receipt: PromotionReceipt = {
    versionedFilePath,
    activeSymlinkPath,
    embeddingFilePath,
    manifestUpdated,
    changelogAppended,
    sha256,
    timestamp: new Date().toISOString(),
  };

  if (bal?.slv) {
    bal.slv({
      voiBit: {
        idx: 'execute-two-tier-promotion',
        val: 0,
        dat: receipt,
        src: versionedFilePath,
      },
    });
  }

  return cpy;
};
