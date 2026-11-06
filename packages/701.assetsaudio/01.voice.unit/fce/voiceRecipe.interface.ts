export type SupportedTtsEngine =
  | 'Chatterbox-Base-FP16'
  | 'StyleTTS-2'
  | 'CosyVoice-300M'
  | 'Parler-TTS'
  | 'Kokoro'
  | 'Piper';

export type ConditioningStrategy =
  | 'ZERO_SHOT_CLONE'
  | 'DESCRIPTION_PROMPT';

export interface DspModifiers {
  pitchShiftSemitones: number;
  formantWarpingFactor: number;
  speedScalar: number;
  breathinessMultiplier: number;
  vocalFryDensity: number;
}

export interface VoiceRecipeConfig {
  characterSlug: string;
  ttsEngine: SupportedTtsEngine;
  conditioningStrategy: ConditioningStrategy;
  referenceTakePath: string;
  embeddingPath: string;
  baseDspModifiers: DspModifiers;
  bannedCadences: string[];
  descriptionPrompt?: string;
}

export interface VoiceRecipeValidationResult {
  isValid: boolean;
  errors: string[];
  recipe: VoiceRecipeConfig;
}
