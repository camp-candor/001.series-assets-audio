import type InputBit from './fce/input.bit.js';

export interface Action<T = any> {
  type: string;
  bale?: T;
}

export const INIT_INPUT = '[Input action] Init Input';
export class InitInput implements Action<InputBit> {
  readonly type = INIT_INPUT;
  constructor(public bale: InputBit) {}
}

export const PROMPT_SOURCE_PATH = '[Input action] Prompt Source Path';
export class PromptSourcePath implements Action<InputBit> {
  readonly type = PROMPT_SOURCE_PATH;
  constructor(public bale: InputBit) {}
}

export type Actions =
  | InitInput
  | PromptSourcePath;
