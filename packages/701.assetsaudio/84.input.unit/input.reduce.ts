import clone from 'clone-deep'
import * as Act from './input.action.js'
import { InputModel } from './input.model.js'
import * as Buzz from './input.buzzer.js'

export function reducer(
    model: InputModel = new InputModel(),
    act: Act.Actions,
    state?: any,
) {
    switch (act.type) {
        case Act.INIT_INPUT:
            return Buzz.initInput(clone(model, true), act.bale, state)

        case Act.PROMPT_SOURCE_PATH:
            return Buzz.promptSourcePath(clone(model, true), act.bale, state)

        default:
            return model
    }
}
