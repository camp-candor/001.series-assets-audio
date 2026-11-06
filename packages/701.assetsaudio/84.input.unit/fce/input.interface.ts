import type InputBit from './input.bit.js';

export default interface Input {
  idx: string;
  lastPromptValue: string;
  activeInputFocused: boolean;
}
