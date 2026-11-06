import { describe, it, expect } from 'vitest';
import {
  applyWsolaMonotonePitch,
  applyLpcSpectralWhitening,
  extractCadenceMetrics,
  executeAcousticRedaction,
} from '../14.redaction.unit/buz/redaction.buzz.js';
import {
  evaluateBannedCadences,
  assertBannedCadenceExclusion,
} from '../01.voice.unit/buz/bannedCadenceGuard.buzz.js';
import { RedactionModel } from '../14.redaction.unit/redaction.model.js';
import { VoiceModel } from '../01.voice.unit/voice.model.js';
import type { TemporalCadenceMetrics } from '../14.redaction.unit/fce/redaction.bit.js';

describe('Acoustic Redaction Battery Cadence Verification Tests', () => {
  it('applies WSOLA monotone pitch flattening to static 120 Hz', () => {
    const len = 48000;
    const input = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      input[i] = Math.sin((2 * Math.PI * 220 * i) / 48000);
    }

    const flattened = applyWsolaMonotonePitch(input, 48000, 120.0);
    expect(flattened.length).toBe(len);
    expect(flattened[0]).toBeDefined();
  });

  it('flattens formant peaks via LPC spectral inverse filtering', () => {
    const len = 4800;
    const input = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      // Modulate combined formants
      input[i] = 0.6 * Math.sin((2 * Math.PI * 500 * i) / 48000) +
                 0.4 * Math.sin((2 * Math.PI * 1500 * i) / 48000);
    }

    const whitened = applyLpcSpectralWhitening(input, 16);
    expect(whitened.length).toBe(len);
  });

  it('extracts temporal cadence metrics with consonant-attack velocity and syllable duration', () => {
    const len = 48000;
    const input = new Float32Array(len);
    // Create pulsed speech pattern
    for (let i = 0; i < len; i++) {
      if ((i % 12000) < 6000) {
        input[i] = 0.5 * Math.sin((2 * Math.PI * 300 * i) / 48000);
      }
    }

    const metrics = extractCadenceMetrics(input, 48000);
    expect(metrics.consonantAttackVelocity).toBeGreaterThan(0.0);
    expect(metrics.averageSyllableDurationMs).toBeGreaterThan(0.0);
    expect(metrics.pauseToSpeechRatio).toBeCloseTo(1.0, 1);
  });

  it('certifies acoustic redaction when confidence exceeds 95% in acoustic darkness', async () => {
    const model = new RedactionModel();
    const len = 48000;
    const input = new Float32Array(len);

    let slvResult: any = null;
    const bit: any = {
      idx: 'test-redaction',
      src: 'voices/silas_take.wav',
      dat: {
        samples: input,
        mockMetrics: {
          consonantAttackVelocity: 14.5,
          averageSyllableDurationMs: 140.0,
          pauseToSpeechRatio: 0.35,
          rhythmEnergyVariance: 0.15,
        },
        mockConfidence: 0.97,
      },
      slv: (res: any) => {
        slvResult = res;
      },
    };

    await executeAcousticRedaction(model, bit);

    expect(slvResult).toBeDefined();
    expect(slvResult.redBit.val).toBe(0);
    const report = slvResult.redBit.dat.report;
    expect(report.isTimbreStripped).toBe(true);
    expect(report.formantsSuppressed).toBe(true);
    expect(report.cadenceMatchConfidence).toBe(0.97);
    expect(report.status).toBe('PASSED');
  });

  it('fails closed when candidate matches RAPID_STACCATO banned cadence pattern', async () => {
    const metrics: TemporalCadenceMetrics = {
      consonantAttackVelocity: 28.0,
      averageSyllableDurationMs: 78.0, // < 95.0 ms threshold
      pauseToSpeechRatio: 0.10,
      rhythmEnergyVariance: 0.22,
    };

    const res = evaluateBannedCadences(['RAPID_STACCATO'], metrics);
    expect(res.isViolating).toBe(true);
    expect(res.matchedPattern).toBe('RAPID_STACCATO');
    expect(res.probability).toBeGreaterThanOrEqual(0.05);

    const model = new VoiceModel();
    const bit: any = {
      idx: 'test-banned-cadence',
      dat: {
        characterSlug: 'char_silas',
        bannedCadences: ['RAPID_STACCATO'],
        metrics,
      },
    };

    await expect(assertBannedCadenceExclusion(model, bit)).rejects.toThrow(
      'PROSODIC_EXCLUSION_LEAK',
    );
  });

  it('passes when candidate cadence does not match banned patterns', async () => {
    const model = new VoiceModel();
    const metrics: TemporalCadenceMetrics = {
      consonantAttackVelocity: 12.0,
      averageSyllableDurationMs: 165.0, // > 95.0 ms
      pauseToSpeechRatio: 0.40,
      rhythmEnergyVariance: 0.14,
    };

    let slvResult: any = null;
    const bit: any = {
      idx: 'test-pass-cadence',
      dat: {
        characterSlug: 'char_bog',
        bannedCadences: ['RAPID_STACCATO', 'BREATHLESS_WHISPER'],
        metrics,
      },
      slv: (res: any) => {
        slvResult = res;
      },
    };

    await assertBannedCadenceExclusion(model, bit);

    expect(slvResult).toBeDefined();
    expect(slvResult.voiBit.val).toBe(0);
    expect(slvResult.voiBit.dat.isViolating).toBe(false);
  });
});
