import type FilterBit from './fce/filter.bit.js';

export interface Action<T = any> {
  type: string;
  bale?: T;
}

export const INIT_FILTER = '[Filter action] Init Filter';
export class InitFilter implements Action<FilterBit> {
  readonly type = INIT_FILTER;
  constructor(public bale: FilterBit) {}
}

export const APPLY_SPECTRAL_HYGIENE = '[Filter action] Apply Spectral Hygiene';
export class ApplySpectralHygiene implements Action<FilterBit> {
  readonly type = APPLY_SPECTRAL_HYGIENE;
  constructor(public bale: FilterBit) {}
}

export type Actions =
  | InitFilter
  | ApplySpectralHygiene;
