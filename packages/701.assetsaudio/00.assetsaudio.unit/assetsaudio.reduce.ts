import clone from 'clone-deep'
import * as Act from './assetsaudio.action.js'
import { AssetsAudioModel } from './assetsaudio.model.js'
import * as Buzz from './assetsaudio.buzzer.js'

export function reducer(
    model: AssetsAudioModel = new AssetsAudioModel(),
    act: Act.Actions,
    state?: any,
) {
    switch (act.type) {
        case Act.INIT_ASSETSAUDIO:
            return Buzz.initAssetsAudio(clone(model, true), act.bale, state)

        case Act.CONFIGURE_LFS:
            return Buzz.configureLfs(clone(model, true), act.bale, state)

        case Act.AUDIT_POISON_BUFFERS:
            return Buzz.auditPoisonBuffers(clone(model, true), act.bale, state)

        case Act.SWEEP_STORAGE_QUOTAS:
            return Buzz.sweepStorageQuotas(clone(model, true), act.bale, state)

        case Act.EXECUTE_MASTER_AUDIT:
            return Buzz.executeMasterAudit(clone(model, true), act.bale, state)

        default:
            return model
    }
}
