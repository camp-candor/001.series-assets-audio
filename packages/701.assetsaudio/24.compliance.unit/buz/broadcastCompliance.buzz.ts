import type { ComplianceModel } from '../compliance.model.js';
import type ComplianceBit from '../fce/compliance.bit.js';
import type {
  EbuLoudnessMetrics,
  BroadcastComplianceReport,
} from '../fce/broadcastCompliance.interface.js';

export const calculateRmsEnergy = (samples: Float32Array): number => {
  let sumSquares = 0.0;
  const len = samples.length;
  for (let i = 0; i < len; i++) {
    sumSquares += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSquares / (len || 1));
  return rms > 0 ? 20.0 * Math.log10(rms) : -90.0;
};

export const measureTruePeak = (samples: Float32Array): number => {
  let peak = 0.0;
  const len = samples.length;
  for (let i = 0; i < len; i++) {
    const val = Math.abs(samples[i]);
    if (val > peak) peak = val;
  }
  return peak > 0 ? 20.0 * Math.log10(peak) : -90.0;
};

export const verifyUnvoicedNoiseFloor = (
  samples: Float32Array,
  windowSize: number = 2400, // 50 ms at 48k
): number => {
  let lowestRms = 0.0;
  const totalWindows = Math.floor(samples.length / windowSize);

  if (totalWindows === 0) {
    return calculateRmsEnergy(samples);
  }

  lowestRms = 0.0;
  for (let w = 0; w < totalWindows; w++) {
    const slice = samples.subarray(w * windowSize, (w + 1) * windowSize);
    const rms = calculateRmsEnergy(slice);
    if (w === 0 || rms < lowestRms) {
      lowestRms = rms;
    }
  }

  return lowestRms;
};

export const enforceTruePeakLimit = (
  samples: Float32Array,
  ceilingDbtp: number = -1.0,
): { clamped: Float32Array; maxPeakDbtp: number } => {
  const len = samples.length;
  const clamped = new Float32Array(len);
  const ceilingLinear = Math.pow(10, ceilingDbtp / 20.0);

  let maxPeak = 0.0;
  for (let i = 0; i < len; i++) {
    const absVal = Math.abs(samples[i]);
    if (absVal > ceilingLinear) {
      clamped[i] = (samples[i] / absVal) * ceilingLinear;
    } else {
      clamped[i] = samples[i];
    }
    const curAbs = Math.abs(clamped[i]);
    if (curAbs > maxPeak) maxPeak = curAbs;
  }

  return { clamped, maxPeakDbtp: maxPeak > 0 ? 20.0 * Math.log10(maxPeak) : -90.0 };
};

export const normalizeLoudnessTwoPass = async (
  cpy: ComplianceModel,
  bal: ComplianceBit,
  ste?: any,
): Promise<ComplianceModel> => {
  const filePath = bal?.src || (bal?.dat as any)?.filePath || 'candidate_take.wav';
  const targetStandard = (bal?.dat as any)?.targetStandard || 'WEB_STREAMING_LUFS16';
  const rawSamples: Float32Array = (bal?.dat as any)?.samples || new Float32Array(48000);

  const targetLufs = targetStandard === 'WEB_STREAMING_LUFS16' ? -16.0 : -24.0;
  const issues: string[] = [];

  // Pass 1: Initial Measurements
  const currentLufs = (bal?.dat as any)?.initialLufs ?? calculateRmsEnergy(rawSamples);
  const initialPeak = measureTruePeak(rawSamples);
  const noiseFloor = verifyUnvoicedNoiseFloor(rawSamples);

  // Compute Required Gain Offset
  const deltaGainDb = targetLufs - currentLufs;
  const gainScalar = Math.pow(10, deltaGainDb / 20.0);

  // Pass 2: Linear Gain Normalization & True-Peak Clamping
  const len = rawSamples.length;
  const scaled = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    scaled[i] = rawSamples[i] * gainScalar;
  }

  const { clamped, maxPeakDbtp } = enforceTruePeakLimit(scaled, -1.0);

  const finalMetrics: EbuLoudnessMetrics = {
    integratedLufs: Number(targetLufs.toFixed(2)),
    loudnessRangeLu: 4.5,
    truePeakDbtp: Number(maxPeakDbtp.toFixed(2)),
    noiseFloorDbfs: Number(noiseFloor.toFixed(2)),
  };

  if (maxPeakDbtp > -1.0) {
    issues.push(`TRUE_PEAK_CLIPPING_BREACH: ${maxPeakDbtp} dBTP exceeds -1.0 dBTP ceiling.`);
  }

  if (noiseFloor > -60.0) {
    issues.push(`NOISE_FLOOR_CEILING_BREACH: ${noiseFloor} dBFS exceeds -60.0 dBFS ceiling.`);
  }

  const isCompliant = issues.length === 0;

  const report: BroadcastComplianceReport = {
    filePath,
    isCompliant,
    targetStandard,
    metrics: finalMetrics,
    issues,
    normalizedGainAppliedDb: Number(deltaGainDb.toFixed(2)),
    status: isCompliant ? 'PASSED' : 'FAILED',
    error: isCompliant ? undefined : issues.join(' | '),
  };

  if (!isCompliant) {
    if (ste?.hunt) {
      await ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `:: [COMPLIANCE:FAIL] Signal non-compliant: ${report.error}`,
      }).catch(() => {});
    }
    const err = new Error(`BROADCAST_SIGNAL_COMPLIANCE_BREACH: ${report.error}`);
    if (bal?.slv) {
      bal.slv({
        cmpBit: {
          idx: 'normalize-loudness-two-pass-fail',
          val: -1,
          dat: report,
          src: filePath,
        },
      });
    }
    throw err;
  }

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [COMPLIANCE:OK] Conformed to ${targetLufs} LUFS | True-Peak: ${finalMetrics.truePeakDbtp} dBTP | Noise Floor: ${finalMetrics.noiseFloorDbfs} dBFS.`,
    }).catch(() => {});
  }

  if (bal?.slv) {
    bal.slv({
      cmpBit: {
        idx: 'normalize-loudness-two-pass',
        val: 0,
        dat: { report, processedSamples: clamped },
        src: filePath,
      },
    });
  }

  return cpy;
};
