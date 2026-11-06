import type DeesserBit from './deesser.bit.js';
import type { DeesserReport } from './deesser.bit.js';

export default interface Deesser {
  idx: string;
  thresholdDbfs: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  lastDeesserReport: DeesserReport | null;
}
