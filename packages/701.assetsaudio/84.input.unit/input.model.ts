import type Input from './fce/input.interface.js';

export class InputModel implements Input {
  idx = '84.input';
  lastPromptValue = '';
  activeInputFocused = false;
}

export default InputModel;
