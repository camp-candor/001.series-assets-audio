import clone from 'clone-deep';
import * as Act from './filter.action.js';
import { FilterModel } from './filter.model.js';
import * as Buzz from './filter.buzzer.js';

export function reducer(
  model: FilterModel = new FilterModel(),
  act: Act.Actions,
  state?: any,
) {
  switch (act.type) {
    case Act.INIT_FILTER:
      return Buzz.initFilter(clone(model, true), act.bale, state);

    case Act.APPLY_SPECTRAL_HYGIENE:
      return Buzz.applySpectralHygiene(clone(model, true), act.bale, state);

    default:
      return model;
  }
}
