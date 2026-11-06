import clone from 'clone-deep'
import * as Act from './redaction.action.js'
import { RedactionModel } from './redaction.model.js'
import * as Buzz from './redaction.buzzer.js'

export function reducer(
    model: RedactionModel = new RedactionModel(),
    act: Act.Actions,
    state?: any,
) {
    switch (act.type) {
        case Act.INIT_REDACTION:
            return Buzz.initRedaction(clone(model, true), act.bale, state)

        case Act.EXECUTE_ACOUSTIC_REDACTION:
            return Buzz.executeAcousticRedaction(
                clone(model, true),
                act.bale,
                state,
            )

        default:
            return model
    }
}
