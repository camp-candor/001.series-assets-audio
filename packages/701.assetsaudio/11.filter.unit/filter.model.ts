import type Filter from './fce/filter.interface.js';
import type { FilterReport } from './fce/filter.bit.js';

export class FilterModel implements Filter {
  idx = '11.filter';
  highPassCutoffHz = 85.0;
  dcOffsetCorrectionEnabled = true;
  notchMainsEnabled = true;
  lastFilterReport: FilterReport | null = null;
}

export default FilterModel;
