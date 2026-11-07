import clone from 'clone-deep'
import * as Act from './music.action.js'
import { MusicModel } from './music.model.js'
import * as Buzz from './music.buzzer.js'

export function reducer(
    model: MusicModel = new MusicModel(),
    act: Act.Actions,
    state?: any,
) {
    switch (act.type) {
        case Act.INIT_MUSIC:
            return Buzz.initMusic(clone(model, true), act.bale, state)

        case Act.VALIDATE_MUSIC_MANIFEST:
            return Buzz.validateMusicManifest(
                clone(model, true),
                act.bale,
                state,
            )

        case Act.VERIFY_LOOP_BOUNDARIES:
            return Buzz.verifyLoopBoundaries(
                clone(model, true),
                act.bale,
                state,
            )

        case Act.RESOLVE_MUSIC_STEM:
            return Buzz.resolveMusicStem(clone(model, true), act.bale, state)

        case Act.REGISTER_MUSIC_STEM:
            return Buzz.registerMusicStem(clone(model, true), act.bale, state)

        case Act.UPDATE_MUSIC:
            return Buzz.updateMusic(clone(model, true), act.bale, state)

        default:
            return model
    }
}
