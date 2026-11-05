import { Action } from '../99.core/interface/action.interface.js'
import AssetsaudioBit from './fce/assetsaudio.bit.js'

// assetsaudio actions

export const INIT_ASSETSAUDIO = '[Assetsaudio action] Init Assetsaudio'
export class InitAssetsaudio implements Action {
    readonly type = INIT_ASSETSAUDIO
    constructor(public bale: AssetsaudioBit) {}
}

export const UPDATE_ASSETSAUDIO = '[Assetsaudio action] Update Assetsaudio'
export class UpdateAssetsaudio implements Action {
    readonly type = UPDATE_ASSETSAUDIO
    constructor(public bale: AssetsaudioBit) {}
}

export const TEST_ASSETSAUDIO = '[Test action] Test Assetsaudio'
export class TestAssetsaudio implements Action {
    readonly type = TEST_ASSETSAUDIO
    constructor(public bale: AssetsaudioBit) {}
}

export const INTELLECT_ASSETSAUDIO = '[Intellect action] Intellect Assetsaudio'
export class IntellectAssetsaudio implements Action {
    readonly type = INTELLECT_ASSETSAUDIO
    constructor(public bale: AssetsaudioBit) {}
}

export const VISION_ASSETSAUDIO = '[Vision action] Vision Assetsaudio'
export class VisionAssetsaudio implements Action {
    readonly type = VISION_ASSETSAUDIO
    constructor(public bale: AssetsaudioBit) {}
}

export const LIST_ASSETSAUDIO = '[List action] List Assetsaudio'
export class ListAssetsaudio implements Action {
    readonly type = LIST_ASSETSAUDIO
    constructor(public bale: AssetsaudioBit) {}
}

export type Actions =
    | InitAssetsaudio
    | UpdateAssetsaudio
    | TestAssetsaudio
    | IntellectAssetsaudio
    | VisionAssetsaudio
    | ListAssetsaudio
