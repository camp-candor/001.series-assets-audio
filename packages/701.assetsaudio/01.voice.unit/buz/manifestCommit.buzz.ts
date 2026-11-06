import fs from 'fs-extra';
import path from 'path';

export const commitManifestVersion = async (
  manifestPath: string,
  characterSlug: string,
  versionNumber: number,
  sha256: string,
  conditionTag?: string,
): Promise<boolean> => {
  await fs.ensureDir(path.dirname(manifestPath));

  let manifest: Record<string, any> = {};
  if (await fs.pathExists(manifestPath)) {
    try {
      manifest = await fs.readJson(manifestPath);
    } catch {
      manifest = {};
    }
  }

  if (!manifest.voices) manifest.voices = {};
  if (!manifest.voices[characterSlug]) {
    manifest.voices[characterSlug] = {
      display_name: characterSlug,
      base_state: 'neutral',
      active_version: `v${versionNumber}`,
    };
  }

  const voice = manifest.voices[characterSlug];
  const versionTag = `v${versionNumber}`;

  if (conditionTag && conditionTag !== 'neutral') {
    if (!voice.condition_variants) voice.condition_variants = {};
    if (!voice.condition_variants[conditionTag]) voice.condition_variants[conditionTag] = {};
    voice.condition_variants[conditionTag].active_version = versionTag;
    voice.condition_variants[conditionTag].sha256 = sha256;
    voice.condition_variants[conditionTag].updated_at = new Date().toISOString();
  } else {
    voice.active_version = versionTag;
    voice.sha256 = sha256;
    voice.updated_at = new Date().toISOString();
  }

  // Sort keys alphabetically for RFC 8785 canonical determinism
  const sortedVoices: Record<string, any> = {};
  for (const k of Object.keys(manifest.voices).sort()) {
    sortedVoices[k] = manifest.voices[k];
  }
  manifest.voices = sortedVoices;

  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpPath = path.join(path.dirname(manifestPath), `.tmp_manifest_${nonce}.json`);

  await fs.writeJson(tmpPath, manifest, { spaces: 2 });
  await fs.rename(tmpPath, manifestPath);

  return true;
};
