import clone from 'clone-deep';
import * as Act from './compliance.action.js';
import { ComplianceModel } from './compliance.model.js';
import * as Buzz from './compliance.buzzer.js';

export function reducer(
  model: ComplianceModel = new ComplianceModel(),
  act: Act.Actions,
  state?: any,
) {
  switch (act.type) {
    case Act.INIT_COMPLIANCE:
      return Buzz.initCompliance(clone(model, true), act.bale, state);

    case Act.PROBE_AUDIO_CONTAINER:
      return Buzz.probeAudioContainer(clone(model, true), act.bale, state);

    case Act.CLASSIFY_SIGNAL_GEOMETRY:
      return Buzz.classifySignalGeometry(clone(model, true), act.bale, state);

    default:
      return model;
  }
}
