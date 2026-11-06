import { describe, it, expect } from 'vitest';
import {
  removeDcOffset,
  applyButterworthHighPass,
  applyMainsNotch,
} from '../11.filter.unit/buz/filter.buzz.js';
import {
  applyDynamicDeesser,
  clampUltrasonicBandwidth,
} from '../16.deesser.unit/buz/deesser.buzz.js';
import {
  measureTruePeak,
  verifyUnvoicedNoiseFloor,
  enforceTruePeakLimit,
  normalizeLoudnessTwoPass,
} from '../24.compliance.unit/buz/broadcastCompliance.buzz.js';
import { ComplianceModel } from '../24.compliance.unit/compliance.model.js';

describe('Broadcast Signal Compliance Quality Verification Battery', () => {
  it('centers DC offset strictly to 0.0 amplitude mean', () => {
    const raw = new Float32Array(1000);
    raw.fill(0.25); // Offset DC by +0.25
    const { cleaned, mean } = removeDcOffset(raw);
    expect(mean).toBeCloseTo(0.25, 5);

    let sum = 0;
    for (let i = 0; i < cleaned.length; i++) sum += cleaned[i];
    expect(sum / cleaned.length).toBeCloseTo(0.0, 5);
  });

  it('attenuates infrasonic sub-bass via 4th-order Butterworth high-pass', () => {
    // Generate 20 Hz sub-bass sine tone
    const len = 48000;
    const subBass = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      subBass[i] = Math.sin((2 * Math.PI * 20 * i) / 48000);
    }
    const filtered = applyButterworthHighPass(subBass, 48000, 85.0);

    // Verify significant attenuation of 20 Hz tone
    let maxFiltered = 0.0;
    for (let i = 20000; i < len; i++) {
      if (Math.abs(filtered[i]) > maxFiltered) maxFiltered = Math.abs(filtered[i]);
    }
    expect(maxFiltered).toBeLessThan(0.15); // > 16 dB attenuation
  });

  it('notches 60 Hz electrical mains hum', () => {
    const len = 48000;
    const mainsTone = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      mainsTone[i] = Math.sin((2 * Math.PI * 60 * i) / 48000);
    }
    const notched = applyMainsNotch(mainsTone, 48000, 60.0, 30.0);

    let maxNotched = 0.0;
    for (let i = 20000; i < len; i++) {
      if (Math.abs(notched[i]) > maxNotched) maxNotched = Math.abs(notched[i]);
    }
    expect(maxNotched).toBeLessThan(0.08);
  });

  it('dynamically compresses high-frequency sibilance exceeding -18 dBFS', () => {
    const len = 2048;
    const sibilantBurst = new Float32Array(len);
    // Burst peaking at 0.5 linear (-6 dBFS)
    sibilantBurst.fill(0.5);

    const { processed, sibilantEnergyDbfs, maxReductionDb } = applyDynamicDeesser(
      sibilantBurst,
      -18.0,
      4.0,
    );

    expect(sibilantEnergyDbfs).toBeCloseTo(-6.02, 1);
    expect(maxReductionDb).toBeGreaterThan(6.0); // Substantial dynamic reduction
    expect(Math.abs(processed[0])).toBeLessThan(0.5);
  });

  it('clamps reconstructed true peaks strictly to -1.0 dBTP ceiling', () => {
    const hotSamples = new Float32Array([1.2, -1.5, 0.95, -0.99]);
    const { clamped, maxPeakDbtp } = enforceTruePeakLimit(hotSamples, -1.0);

    expect(maxPeakDbtp).toBeLessThanOrEqual(-0.99);
    for (let i = 0; i < clamped.length; i++) {
      expect(Math.abs(clamped[i])).toBeLessThanOrEqual(Math.pow(10, -1.0 / 20.0));
    }
  });

  it('conforms integrated loudness to -16.0 LUFS web target and passes clean take', async () => {
    const model = new ComplianceModel();
    const len = 48000;
    const testTone = new Float32Array(len);
    for (let i = 2400; i < len; i++) {
      testTone[i] = 0.05 * Math.sin((2 * Math.PI * 440 * i) / 48000);
    }

    let slvResult: any = null;
    const bit: any = {
      idx: 'test-loudness',
      src: 'voices/silas_take.wav',
      dat: {
        samples: testTone,
        initialLufs: -26.0,
        targetStandard: 'WEB_STREAMING_LUFS16',
      },
      slv: (res: any) => {
        slvResult = res;
      },
    };

    normalizeLoudnessTwoPass(model, bit);

    expect(slvResult).toBeDefined();
    expect(slvResult.cmpBit.val).toBe(0);
    const report = slvResult.cmpBit.dat.report;
    expect(report.isCompliant).toBe(true);
    expect(report.metrics.integratedLufs).toBe(-16.0);
    expect(report.metrics.truePeakDbtp).toBeLessThanOrEqual(-1.0);
  });

  it('fails closed and throws breach error if unvoiced noise floor exceeds -60 dBFS', async () => {
    const model = new ComplianceModel();
    const len = 48000;
    const noisyTone = new Float32Array(len);
    // Continuous noisy floor at -45 dBFS
    noisyTone.fill(0.01);

    const bit: any = {
      idx: 'test-noise-floor-breach',
      src: 'voices/noisy_take.wav',
      dat: {
        samples: noisyTone,
        initialLufs: -16.0,
      },
    };

    expect(() => normalizeLoudnessTwoPass(model, bit)).toThrow(
      'BROADCAST_SIGNAL_COMPLIANCE_BREACH',
    );
  });
});
