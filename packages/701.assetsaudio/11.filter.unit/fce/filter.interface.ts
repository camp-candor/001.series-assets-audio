import type FilterBit from './filter.bit.js';
import type { FilterReport } from './filter.bit.js';

export default interface Filter {
  idx: string;
  highPassCutoffHz: number;
  dcOffsetCorrectionEnabled: boolean;
  notchMainsEnabled: boolean;
  lastFilterReport: FilterReport | null;
}
