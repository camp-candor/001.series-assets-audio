import clone from 'clone-deep'
import * as Act from './assetsaudio.action.js'
import { AssetsaudioModel } from './assetsaudio.model.js'
import * as Buzz from './assetsaudio.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: AssetsaudioModel = new AssetsaudioModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_ASSETSAUDIO:
            return Buzz.updateAssetsaudio(clone(model), act.bale, state)

        case Act.INIT_ASSETSAUDIO:
            return Buzz.initAssetsaudio(clone(model), act.bale, state)

        case Act.TEST_ASSETSAUDIO:
            return Buzz.testAssetsaudio(clone(model), act.bale, state)

        case Act.LIST_ASSETSAUDIO:
            return Buzz.listAssetsaudio(clone(model), act.bale, state)

        default:
            return model
    }
}
