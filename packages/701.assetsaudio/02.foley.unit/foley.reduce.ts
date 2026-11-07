import clone from 'clone-deep'
import * as Act from './foley.action.js'
import { FoleyModel } from './foley.model.js'
import * as Buzz from './foley.buzzer.js'

export function reducer(
    model: FoleyModel = new FoleyModel(),
    act: Act.Actions,
    state?: any,
) {
    switch (act.type) {
        case Act.INIT_FOLEY:
            return Buzz.initFoley(clone(model, true), act.bale, state)

        case Act.VALIDATE_FOLEY_REGISTRY:
            return Buzz.validateFoleyRegistry(
                clone(model, true),
                act.bale,
                state,
            )

        case Act.VERIFY_VARIATION_POOLS:
            return Buzz.verifyVariationPools(
                clone(model, true),
                act.bale,
                state,
            )

        case Act.RESOLVE_FOLEY_CUE:
            return Buzz.resolveFoleyCue(clone(model, true), act.bale, state)

        case Act.REGISTER_FOLEY_ASSET:
            return Buzz.registerFoleyAsset(clone(model, true), act.bale, state)

        case Act.UPDATE_FOLEY:
            return Buzz.updateFoley(clone(model, true), act.bale, state)

        default:
            return model
    }
}
