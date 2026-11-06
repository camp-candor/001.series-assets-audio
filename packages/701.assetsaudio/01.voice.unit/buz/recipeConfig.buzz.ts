import fs from 'fs-extra';
import path from 'path';
import type { VoiceModel } from '../voice.model.js';
import type VoiceBit from '../fce/voice.bit.js';
import type {
  SupportedTtsEngine,
  DspModifiers,
  VoiceRecipeConfig,
} from '../fce/voiceRecipe.interface.js';

export const SUPPORTED_TTS_ENGINES: Set<SupportedTtsEngine> = new Set([
  'Chatterbox-Base-FP16',
  'StyleTTS-2',
  'CosyVoice-300M',
  'Parler-TTS',
  'Kokoro',
  'Piper',
]);

export const DEFAULT_DSP_MODIFIERS: DspModifiers = {
  pitchShiftSemitones: 0.0,
  formantWarpingFactor: 1.0,
  speedScalar: 1.0,
  breathinessMultiplier: 1.0,
  vocalFryDensity: 0.0,
};

export const validateDspModifiers = (
  mods?: Partial<DspModifiers>,
): DspModifiers => {
  const merged: DspModifiers = {
    ...DEFAULT_DSP_MODIFIERS,
    ...(mods || {}),
  };

  if (merged.pitchShiftSemitones < -12.0 || merged.pitchShiftSemitones > 12.0) {
    throw new Error(
      `DSP_BOUNDS_BREACH: pitchShiftSemitones value (${merged.pitchShiftSemitones}) outside [-12.0, 12.0] range.`,
    );
  }

  if (merged.formantWarpingFactor < 0.5 || merged.formantWarpingFactor > 2.0) {
    throw new Error(
      `DSP_BOUNDS_BREACH: formantWarpingFactor value (${merged.formantWarpingFactor}) outside [0.5, 2.0] range.`,
    );
  }

  if (merged.speedScalar < 0.1 || merged.speedScalar > 3.0) {
    throw new Error(
      `DSP_BOUNDS_BREACH: speedScalar value (${merged.speedScalar}) outside [0.1, 3.0] range.`,
    );
  }

  if (merged.breathinessMultiplier < 1.0 || merged.breathinessMultiplier > 3.5) {
    throw new Error(
      `DSP_BOUNDS_BREACH: breathinessMultiplier value (${merged.breathinessMultiplier}) outside [1.0, 3.5] range.`,
    );
  }

  if (merged.vocalFryDensity < 0.0 || merged.vocalFryDensity > 1.0) {
    throw new Error(
      `DSP_BOUNDS_BREACH: vocalFryDensity value (${merged.vocalFryDensity}) outside [0.0, 1.0] range.`,
    );
  }

  return merged;
};

export const configureVoiceRecipe = async (
  cpy: VoiceModel,
  bal: VoiceBit,
  ste?: any,
): Promise<VoiceModel> => {
  const payload = (bal?.dat as any) || {};
  const characterSlug = (payload.characterSlug || bal?.src || '').trim().toLowerCase();
  const ttsEngine = payload.ttsEngine as SupportedTtsEngine;

  if (!characterSlug) {
    const errorMsg = 'RECIPE_SLUG_EMPTY: Character slug must be provided for recipe configuration.';
    if (ste?.hunt) {
      await ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `:: [RECIPE:FAIL] ${errorMsg}`,
      }).catch(() => {});
    }
    const err = new Error(errorMsg);
    if (bal?.slv) {
      bal.slv({ voiBit: { idx: 'configure-voice-recipe-fail', val: -1 } });
    }
    throw err;
  }

  if (!SUPPORTED_TTS_ENGINES.has(ttsEngine)) {
    const errorMsg = `UNSUPPORTED_VOCODER_ENGINE_BREACH: Engine [${ttsEngine}] is not a certified neural vocoder target.`;
    if (ste?.hunt) {
      await ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `:: [VOCODER:FAIL] ${errorMsg}`,
      }).catch(() => {});
    }
    const err = new Error(errorMsg);
    if (bal?.slv) {
      bal.slv({ voiBit: { idx: 'configure-voice-recipe-fail', val: -1, src: characterSlug } });
    }
    throw err;
  }

  const dsp = validateDspModifiers(payload.baseDspModifiers);

  const recipe: VoiceRecipeConfig = {
    characterSlug,
    ttsEngine,
    conditioningStrategy: payload.conditioningStrategy || 'ZERO_SHOT_CLONE',
    referenceTakePath: payload.referenceTakePath || `voices/versions/${characterSlug}_v1.wav`,
    embeddingPath: payload.embeddingPath || `voices/embeddings/${characterSlug}_v1.pt`,
    baseDspModifiers: dsp,
    bannedCadences: Array.isArray(payload.bannedCadences) ? payload.bannedCadences : [],
    descriptionPrompt: payload.descriptionPrompt,
  };

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [RECIPE:CONFIG] Configured voice recipe for [${characterSlug}] using [${ttsEngine}].`,
    }).catch(() => {});
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [DSP:CALIBRATE] Pitch: ${dsp.pitchShiftSemitones} st | Formant: ${dsp.formantWarpingFactor} | Speed: ${dsp.speedScalar}x.`,
    }).catch(() => {});
  }

  if (bal?.slv) {
    bal.slv({
      voiBit: {
        idx: 'configure-voice-recipe',
        val: 0,
        dat: recipe,
        src: characterSlug,
      },
    });
  }

  return cpy;
};

export const commitRecipeToManifest = async (
  cpy: VoiceModel,
  bal: VoiceBit,
  ste?: any,
): Promise<VoiceModel> => {
  const recipe: VoiceRecipeConfig = (bal?.dat as any)?.recipe || (bal?.dat as any);
  if (!recipe || !recipe.characterSlug) {
    const errorMsg = 'MANIFEST_RECIPE_PAYLOAD_MISSING: Cannot commit empty recipe to manifest.';
    const err = new Error(errorMsg);
    if (bal?.slv) {
      bal.slv({ voiBit: { idx: 'commit-recipe-to-manifest-fail', val: -1 } });
    }
    throw err;
  }

  const rootDir = cpy.voicesRoot || process.cwd();
  const manifestPath = path.resolve(rootDir, 'voices', 'voice_manifest.json');
  await fs.ensureDir(path.dirname(manifestPath));

  let manifest: Record<string, any> = {};
  if (await fs.pathExists(manifestPath)) {
    try {
      manifest = await fs.readJson(manifestPath);
    } catch {
      manifest = {};
    }
  }

  if (!manifest.voices) {
    manifest.voices = {};
  }

  const existing = manifest.voices[recipe.characterSlug] || {};

  manifest.voices[recipe.characterSlug] = {
    ...existing,
    display_name: existing.display_name || recipe.characterSlug,
    base_state: existing.base_state || 'neutral',
    tts_engine: recipe.ttsEngine,
    conditioning: {
      strategy: recipe.conditioningStrategy,
      reference_take: recipe.referenceTakePath,
      embedding_path: recipe.embeddingPath,
      description_prompt: recipe.descriptionPrompt,
    },
    base_dsp_modifiers: {
      pitch_shift_semitones: recipe.baseDspModifiers.pitchShiftSemitones,
      formant_warping_factor: recipe.baseDspModifiers.formantWarpingFactor,
      speed_scalar: recipe.baseDspModifiers.speedScalar,
      breathiness_multiplier: recipe.baseDspModifiers.breathinessMultiplier,
      vocal_fry_density: recipe.baseDspModifiers.vocalFryDensity,
    },
    banned_cadences: recipe.bannedCadences,
  };

  // Sort keys alphabetically for RFC 8785 canonical determinism
  const sortedVoices: Record<string, any> = {};
  for (const k of Object.keys(manifest.voices).sort()) {
    sortedVoices[k] = manifest.voices[k];
  }
  manifest.voices = sortedVoices;

  const tmpPath = path.resolve(rootDir, 'voices', `.tmp_voice_manifest_${Date.now()}.json`);
  await fs.writeJson(tmpPath, manifest, { spaces: 2 });
  await fs.rename(tmpPath, manifestPath);

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [MANIFEST:COMMIT] Sealed recipe for [${recipe.characterSlug}] into voice_manifest.json.`,
    }).catch(() => {});
  }

  if (bal?.slv) {
    bal.slv({
      voiBit: {
        idx: 'commit-recipe-to-manifest',
        val: 0,
        dat: manifest,
        src: manifestPath,
      },
    });
  }

  return cpy;
};
