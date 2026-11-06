import type RedactionBit from './fce/redaction.bit.js';

export interface Action<T = any> {
  type: string;
  bale?: T;
}

export const INIT_REDACTION = '[Redaction action] Init Redaction';
export class InitRedaction implements Action<RedactionBit> {
  readonly type = INIT_REDACTION;
  constructor(public bale: RedactionBit) {}
}

export const EXECUTE_ACOUSTIC_REDACTION = '[Redaction action] Execute Acoustic Redaction';
export class ExecuteAcousticRedaction implements Action<RedactionBit> {
  readonly type = EXECUTE_ACOUSTIC_REDACTION;
  constructor(public bale: RedactionBit) {}
}

export type Actions =
  | InitRedaction
  | ExecuteAcousticRedaction;
