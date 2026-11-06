import Model from './99.core/interface/model.interface.js'

import AssetsaudioUnit from './00.assetsaudio.unit/assetsaudio.unit.js'
import VoiceUnit from './01.voice.unit/voice.unit.js'
import CollectUnit from './97.collect.unit/collect.unit.js'
import MenuUnit from './98.menu.unit/menu.unit.js'
import BusUnit from './99.bus.unit/bus.unit.js'

import Assetsaudio from './00.assetsaudio.unit/fce/assetsaudio.interface.js'
import { AssetsaudioModel } from './00.assetsaudio.unit/assetsaudio.model.js'
import Voice from './01.voice.unit/fce/voice.interface.js'
import { VoiceModel } from './01.voice.unit/voice.model.js'
import Collect from './97.collect.unit/fce/collect.interface.js'
import { CollectModel } from './97.collect.unit/collect.model.js'
import Menu from './98.menu.unit/fce/menu.interface.js'
import { MenuModel } from './98.menu.unit/menu.model.js'
import Bus from './99.bus.unit/fce/bus.interface.js'
import { BusModel } from './99.bus.unit/bus.model.js'

export const list: Array<any> = [
    AssetsaudioUnit,
    VoiceUnit,
    CollectUnit,
    MenuUnit,
    BusUnit,
]

import * as reduceFromAssetsaudio from './00.assetsaudio.unit/assetsaudio.reduce.js'
import * as reduceFromVoice from './01.voice.unit/voice.reduce.js'
import * as reduceFromCollect from './97.collect.unit/collect.reduce.js'
import * as reduceFromMenu from './98.menu.unit/menu.reduce.js'
import * as reduceFromBus from './99.bus.unit/bus.reduce.js'

export const reducer: any = {
    assetsaudio: reduceFromAssetsaudio.reducer,
    voice: reduceFromVoice.reducer,
    collect: reduceFromCollect.reducer,
    menu: reduceFromMenu.reducer,
    bus: reduceFromBus.reducer,
}

export default class UnitData implements Model {
    assetsaudio: Assetsaudio = new AssetsaudioModel()
    voice: Voice = new VoiceModel()
    collect: Collect = new CollectModel()
    menu: Menu = new MenuModel()
    bus: Bus = new BusModel()
}
