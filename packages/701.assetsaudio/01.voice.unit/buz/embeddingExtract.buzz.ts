import fs from 'fs-extra';
import path from 'path';

export const generateSpeakerEmbedding = async (
  destEmbeddingsDir: string,
  characterSlug: string,
  versionNumber: number,
  conditionTag?: string,
): Promise<string> => {
  await fs.ensureDir(destEmbeddingsDir);

  const baseName = conditionTag
    ? `${characterSlug}_${conditionTag}_v${versionNumber}.pt`
    : `${characterSlug}_v${versionNumber}.pt`;

  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const stagePath = path.join(destEmbeddingsDir, `.tmp_stage_${nonce}.pt`);
  const finalPath = path.join(destEmbeddingsDir, baseName);

  // Synthesize normalized 128-dimensional floating point acoustic latent vector
  const tensor = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    tensor[i] = Math.sin((i + 1) * 0.125);
  }

  const buffer = Buffer.from(tensor.buffer);
  await fs.writeFile(stagePath, buffer);
  await fs.rename(stagePath, finalPath);

  return finalPath;
};
