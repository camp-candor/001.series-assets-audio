import path from 'path';
import type { ComplianceModel } from '../compliance.model.js';
import type ComplianceBit from '../fce/compliance.bit.js';
import type { AudioProbeResult, SignalGeometryClassification } from '../fce/compliance.bit.js';

export const classifySignalGeometry = async (
  cpy: ComplianceModel,
  bal: ComplianceBit,
  ste?: any,
): Promise<ComplianceModel> => {
  const probeData: AudioProbeResult | null =
    (bal?.dat as AudioProbeResult) || cpy.lastProbeResult;

  if (!probeData) {
    const errorMsg = 'CLASSIFICATION_PAYLOAD_MISSING: No probe details available for classification.';
    if (ste?.hunt) {
      await ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `:: [CLASSIFY:FAIL] ${errorMsg}`,
      }).catch(() => {});
    }
    const err = new Error(errorMsg);
    if (bal?.slv) {
      bal.slv({ cmpBit: { idx: 'classify-signal-geometry-fail', val: -1 } });
    }
    throw err;
  }

  const issues: string[] = [];
  let category: SignalGeometryClassification['category'] = 'UNKNOWN';

  const ext = path.extname(probeData.filePath).toLowerCase();
  const codec = (probeData.codecName || '').toLowerCase();
  const format = (probeData.containerFormat || '').toLowerCase();

  // 1. Identify Broad Encoding Category
  if (ext === '.pt') {
    category = 'TENSOR_EMBEDDING';
  } else if (codec.startsWith('pcm') || format.includes('wav')) {
    category = 'LINEAR_PCM';
  } else if (codec === 'flac' || format.includes('flac') || codec === 'alac') {
    category = 'LOSSLESS_COMPRESSED';
  } else if (['mp3', 'aac', 'vorbis', 'opus'].includes(codec) || ['mp3', 'aac', 'ogg'].some((f) => format.includes(f))) {
    category = 'LOSSY_STREAM';
  }

  // 2. Evaluate Broadcast Geometry Standards (48 kHz / 24-bit / Mono)
  if (category === 'TENSOR_EMBEDDING') {
    // Neural embeddings are pure tensors, not audio frames
  } else {
    if (probeData.sampleRate !== 48000) {
      issues.push(`SAMPLE_RATE_DEVIATION_${probeData.sampleRate}_HZ`);
    }

    if (probeData.bitDepth !== 24) {
      issues.push(`BIT_DEPTH_DEVIATION_${probeData.bitDepth}_BIT`);
    }

    if (probeData.channels !== 1) {
      issues.push(`CHANNEL_TOPOLOGY_NON_MONO_${probeData.channels}_CH`);
    }
  }

  // 3. Determine Conformance Recommendation
  let recommendation: SignalGeometryClassification['recommendation'] = 'REJECT';
  let isCompliant = false;

  if (category === 'LINEAR_PCM' && issues.length === 0) {
    recommendation = 'READY_FOR_VAULT';
    isCompliant = true;
  } else if (category === 'TENSOR_EMBEDDING') {
    recommendation = 'READY_FOR_VAULT';
    isCompliant = true;
  } else if (category === 'LINEAR_PCM' || category === 'LOSSLESS_COMPRESSED' || category === 'LOSSY_STREAM') {
    recommendation = 'NEEDS_CONFORMANCE';
  }

  const classification: SignalGeometryClassification = {
    category,
    isBroadcastCompliantGeometry: isCompliant,
    geometryIssues: issues,
    recommendation,
    probeDetails: probeData,
  };

  cpy.lastClassification = classification;
  cpy.complianceStatus = isCompliant
    ? 'COMPLIANT'
    : recommendation === 'NEEDS_CONFORMANCE'
    ? 'NEEDS_CONFORMANCE'
    : 'NON_COMPLIANT';

  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: `>> [CLASSIFY] Signal geometry classified as [${category}] | Verdict: [${recommendation}] (${issues.length} issue(s)).`,
    }).catch(() => {});
  }

  if (bal?.slv) {
    bal.slv({
      cmpBit: {
        idx: 'classify-signal-geometry',
        val: isCompliant ? 0 : 1,
        dat: classification,
        src: probeData.filePath,
      },
    });
  }

  return cpy;
};