import type { VoiceModel } from '../voice.model.js';
import type VoiceBit from '../fce/voice.bit.js';
import type { TemporalCadenceMetrics } from '../../14.redaction.unit/fce/redaction.bit.js';

export interface BannedCadenceCheckPayload {
  characterSlug: string;
  bannedCadences: string[];
  metrics: TemporalCadenceMetrics;
}

export const evaluateBannedCadences = (
  bannedCadences: string[],
  metrics: TemporalCadenceMetrics,
): { isViolating: boolean; matchedPattern?: string; probability: number } => {
  for (const pattern of bannedCadences) {
    if (pattern === 'RAPID_STACCATO') {
      if (metrics.averageSyllableDurationMs < 95.0) {
        return {
          isViolating: true,
          matchedPattern: pattern,
          probability: 0.98,
        };
      }
    }
    if (pattern === 'BREATHLESS_WHISPER') {
      if (metrics.pauseToSpeechRatio < 0.15 && metrics.consonantAttackVelocity > 25.0) {
        return {
          isViolating: true,
          matchedPattern: pattern,
          probability: 0.92,
        };
      }
    }
    if (pattern === 'MONOTONOUS_DRONE') {
      if (metrics.rhythmEnergyVariance < 0.05) {
        return {
          isViolating: true,
          matchedPattern: pattern,
          probability: 0.95,
        };
      }
    }
  }

  return { isViolating: false, probability: 0.01 };
};

export const assertBannedCadenceExclusion = async (
  cpy: VoiceModel,
  bal: VoiceBit,
  ste?: any,
): Promise<VoiceModel> => {
  const payload: BannedCadenceCheckPayload = (bal?.dat as any) || {};
  const bannedList = payload.bannedCadences || [];
  const metrics = payload.metrics;

  if (!metrics) {
    const errorMsg = 'CADENCE_METRICS_MISSING: Cannot evaluate banned cadences without metrics.';
    const err = new Error(errorMsg);
    if (bal?.slv) {
      bal.slv({ voiBit: { idx: 'assert-banned-cadence-fail', val: -1 } });
    }
    throw err;
  }

  const { isViolating, matchedPattern, probability } = evaluateBannedCadences(
    bannedList,
    metrics,
  );

  if (isViolating) {
    const errorMsg = `PROSODIC_EXCLUSION_LEAK: Detected banned cadence [${matchedPattern}] with P = ${probability.toFixed(2)} (>= 0.05 ceiling).`;
    if (ste?.hunt) {
      await ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `:: [GUARD:FAIL] ${errorMsg}`,
      }).catch(() => {});
    }
    const err = new Error(errorMsg);
    if (bal?.slv) {
      bal.slv({
        voiBit: {
          idx: 'assert-banned-cadence-fail',
          val: -1,
          dat: { isViolating, matchedPattern, probability },
        },
      });
    }
    throw err;
  }

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [GUARD:OK] Prosodic exclusion certified: P(Cadence in banned_cadences) < 0.05.`,
    }).catch(() => {});
  }

  if (bal?.slv) {
    bal.slv({
      voiBit: {
        idx: 'assert-banned-cadence',
        val: 0,
        dat: { isViolating: false, probability },
      },
    });
  }

  return cpy;
};
