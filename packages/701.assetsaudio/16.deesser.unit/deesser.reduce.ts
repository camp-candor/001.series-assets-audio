import clone from 'clone-deep'
import * as Act from './deesser.action.js'
import { DeesserModel } from './deesser.model.js'
import * as Buzz from './deesser.buzzer.js'

export function reducer(
    model: DeesserModel = new DeesserModel(),
    act: Act.Actions,
    state?: any,
) {
    switch (act.type) {
        case Act.INIT_DEESSER:
            return Buzz.initDeesser(clone(model, true), act.bale, state)

        case Act.ATTENUATE_SIBILANCE:
            return Buzz.attenuateSibilance(clone(model, true), act.bale, state)

        default:
            return model
    }
}
