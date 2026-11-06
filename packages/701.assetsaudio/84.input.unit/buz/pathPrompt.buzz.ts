import type { InputModel } from '../input.model.js';
import type InputBit from '../fce/input.bit.js';
import type { InputSubmissionReceipt } from '../fce/input.bit.js';

export const initInput = (
  cpy: InputModel,
  bal: InputBit,
  ste?: any,
): InputModel => {
  if (bal?.slv) {
    bal.slv({ putBit: { idx: 'init-input', val: 0 } });
  }
  return cpy;
};

export const promptSourcePath = (
  cpy: InputModel,
  bal: InputBit,
  ste?: any,
): InputModel => {
  const terminal = ste?.value?.terminal;
  const blessed = terminal?.blessed;
  const screen = terminal?.screen;

  if (ste?.hunt) {
    ste.hunt('[Console action] Update Console', {
      idx: 'cns00',
      src: '>> [INPUT] Capturing source audio file path from operator.',
    }).catch(() => {});
  }

  // Headless test or non-interactive environment fallback
  if (!screen || !blessed) {
    const rawVal = bal?.src || (bal?.dat as any)?.defaultText || '';
    cpy.lastPromptValue = rawVal;
    cpy.activeInputFocused = false;

    const receipt: InputSubmissionReceipt = {
      submitted: Boolean(rawVal),
      cancelled: !rawVal,
      value: rawVal,
    };

    if (bal?.slv) {
      bal.slv({
        putBit: {
          idx: 'prompt-source-path',
          src: rawVal,
          val: rawVal ? 0 : -1,
          dat: receipt,
        },
      });
    }
    return cpy;
  }

  const labelText = bal?.txt || 'Enter source audio file path on disk:';
  const defaultVal = (bal?.dat as any)?.defaultText || '';

  const form = blessed.form({
    parent: screen,
    name: 'ingress-form',
    keys: true,
    left: 'center',
    top: 'center',
    width: '80%',
    height: 7,
    border: { type: 'line' },
    style: {
      border: { fg: 'yellow' },
      bg: 'black',
    },
  });

  blessed.box({
    parent: form,
    left: 2,
    top: 1,
    height: 1,
    content: labelText,
    style: { fg: 'white', bold: true },
  });

  const input = blessed.textbox({
    parent: form,
    name: 'source-path-input',
    input: true,
    keys: true,
    mouse: true,
    left: 2,
    top: 3,
    height: 1,
    width: '90%',
    value: defaultVal,
    style: {
      bg: 'blue',
      focus: { bg: 'cyan', fg: 'black' },
    },
  });

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      input.unkey(['escape'], handleCancel);
      form.destroy();
      screen.render();
    } catch {
      // Defensive teardown
    }
    cpy.activeInputFocused = false;
  };

  const handleCancel = () => {
    cleanup();
    if (ste?.hunt) {
      ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: '>> [INPUT:CANCEL] Path input cancelled by operator.',
      }).catch(() => {});
    }
    const receipt: InputSubmissionReceipt = {
      submitted: false,
      cancelled: true,
      value: '',
    };
    if (bal?.slv) {
      bal.slv({
        putBit: {
          idx: 'prompt-source-path-cancel',
          src: '',
          val: -1,
          dat: receipt,
        },
      });
    }
  };

  input.key(['escape'], handleCancel);

  input.on('submit', (val: string) => {
    const rawVal = (val || '').trim();
    cleanup();
    cpy.lastPromptValue = rawVal;

    if (ste?.hunt) {
      ste.hunt('[Console action] Update Console', {
        idx: 'cns00',
        src: `>> [INPUT:SUBMIT] Received path: [${rawVal}]`,
      }).catch(() => {});
    }

    const receipt: InputSubmissionReceipt = {
      submitted: true,
      cancelled: false,
      value: rawVal,
    };

    if (bal?.slv) {
      bal.slv({
        putBit: {
          idx: 'prompt-source-path',
          src: rawVal,
          val: 0,
          dat: receipt,
        },
      });
    }
  });

  cpy.activeInputFocused = true;
  input.focus();
  screen.render();

  return cpy;
};
