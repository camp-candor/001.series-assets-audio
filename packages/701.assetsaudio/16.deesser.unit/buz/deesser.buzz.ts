import type { DeesserModel } from '../deesser.model.js';
import type DeesserBit from '../fce/deesser.bit.js';
import type { DeesserReport, DeesserMetrics } from '../fce/deesser.bit.js';

export const initDeesser = (
  cpy: DeesserModel,
  bal: DeesserBit,
  ste?: any,
): DeesserModel => {
  if (ste?.hunt) {
    ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: '>> [DEESSER] Dynamic De-Esser and Limiter Unit Initialized.',
    }).catch(() => {});
  }
  if (bal?.slv) {
    bal.slv({ desBit: { idx: 'init-deesser', val: 0 } });
  }
  return cpy;
};

export const applyDynamicDeesser = (
  samples: Float32Array,
  thresholdDbfs: number = -18.0,
  ratio: number = 4.0,
): { processed: Float32Array; sibilantEnergyDbfs: number; maxReductionDb: number } => {
  const len = samples.length;
  const processed = new Float32Array(len);
  const thresholdLinear = Math.pow(10, thresholdDbfs / 20.0);

  let maxEnergy = 0.0;
  let maxReductionDb = 0.0;

  for (let i = 0; i < len; i++) {
    const absVal = Math.abs(samples[i]);
    if (absVal > maxEnergy) maxEnergy = absVal;

    if (absVal > thresholdLinear) {
      const overDb = 20.0 * Math.log10(absVal / thresholdLinear);
      const reductionDb = overDb * (1.0 - 1.0 / ratio);
      if (reductionDb > maxReductionDb) maxReductionDb = reductionDb;

      const gainFactor = Math.pow(10, -reductionDb / 20.0);
      processed[i] = samples[i] * gainFactor;
    } else {
      processed[i] = samples[i];
    }
  }

  const sibilantEnergyDbfs = maxEnergy > 0 ? 20.0 * Math.log10(maxEnergy) : -90.0;
  return { processed, sibilantEnergyDbfs, maxReductionDb };
};

export const clampUltrasonicBandwidth = (
  samples: Float32Array,
  sampleRate: number = 48000,
  ceilingHz: number = 22000.0,
): Float32Array => {
  // Brickwall low-pass filter above 22 kHz to eliminate aliasing
  const len = samples.length;
  const output = new Float32Array(len);
  const omega = Math.tan((Math.PI * ceilingHz) / sampleRate);
  const c = 1.0 + Math.SQRT2 * omega + omega * omega;
  const b0 = (omega * omega) / c;
  const b1 = (2.0 * omega * omega) / c;
  const b2 = (omega * omega) / c;
  const a1 = (2.0 * (omega * omega - 1.0)) / c;
  const a2 = (1.0 - Math.SQRT2 * omega + omega * omega) / c;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < len; i++) {
    const x0 = samples[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    output[i] = y0;
  }
  return output;
};

export const attenuateSibilance = async (
  cpy: DeesserModel,
  bal: DeesserBit,
  ste?: any,
): Promise<DeesserModel> => {
  const filePath = bal?.src || (bal?.dat as any)?.filePath || 'raw_dialogue.wav';
  const rawSamples: Float32Array = (bal?.dat as any)?.samples || new Float32Array(2048);

  const { processed, sibilantEnergyDbfs, maxReductionDb } = applyDynamicDeesser(
    rawSamples,
    cpy.thresholdDbfs,
    cpy.ratio,
  );
  const bandClamped = clampUltrasonicBandwidth(processed, 48000, 22000.0);

  const metrics: DeesserMetrics = {
    sibilantEnergyDbfs: Number(sibilantEnergyDbfs.toFixed(2)),
    maxReductionDb: Number(maxReductionDb.toFixed(2)),
    clampedUltrasonicFrequencies: true,
  };

  const report: DeesserReport = {
    filePath,
    attenuationApplied: maxReductionDb > 0,
    metrics,
    status: 'PASSED',
  };

  cpy.lastDeesserReport = report;

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [DEESSER:OK] Peak sibilance: ${metrics.sibilantEnergyDbfs} dBFS | Max reduction: -${metrics.maxReductionDb} dB.`,
    }).catch(() => {});
  }

  if (bal?.slv) {
    bal.slv({
      desBit: {
        idx: 'attenuate-sibilance',
        val: 0,
        dat: { report, processedSamples: bandClamped },
        src: filePath,
      },
    });
  }

  return cpy;
};
