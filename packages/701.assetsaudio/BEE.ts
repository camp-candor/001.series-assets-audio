import Model from './99.core/interface/model.interface.js'

import AssetsaudioUnit from './00.assetsaudio.unit/assetsaudio.unit.js'
import VoiceUnit from './01.voice.unit/voice.unit.js'
import FoleyUnit from './02.foley.unit/foley.unit.js'
import MusicUnit from './03.music.unit/music.unit.js'
import FilterUnit from './11.filter.unit/filter.unit.js'
import RedactionUnit from './14.redaction.unit/redaction.unit.js'
import DeesserUnit from './16.deesser.unit/deesser.unit.js'
import ComplianceUnit from './24.compliance.unit/compliance.unit.js'
import InputUnit from './84.input.unit/input.unit.js'
import CollectUnit from './97.collect.unit/collect.unit.js'
import MenuUnit from './98.menu.unit/menu.unit.js'
import BusUnit from './99.bus.unit/bus.unit.js'
import SyncUnit from './25.sync.unit/sync.unit.js'

import Assetsaudio from './00.assetsaudio.unit/fce/assetsaudio.interface.js'
import { AssetsAudioModel } from './00.assetsaudio.unit/assetsaudio.model.js'
import Voice from './01.voice.unit/fce/voice.interface.js'
import { VoiceModel } from './01.voice.unit/voice.model.js'
import Foley from './02.foley.unit/fce/foley.interface.js'
import { FoleyModel } from './02.foley.unit/foley.model.js'
import Music from './03.music.unit/fce/music.interface.js'
import { MusicModel } from './03.music.unit/music.model.js'
import Filter from './11.filter.unit/fce/filter.interface.js'
import { FilterModel } from './11.filter.unit/filter.model.js'
import Redaction from './14.redaction.unit/fce/redaction.interface.js'
import { RedactionModel } from './14.redaction.unit/redaction.model.js'
import Deesser from './16.deesser.unit/fce/deesser.interface.js'
import { DeesserModel } from './16.deesser.unit/deesser.model.js'
import Compliance from './24.compliance.unit/fce/compliance.interface.js'
import { ComplianceModel } from './24.compliance.unit/compliance.model.js'
import Input from './84.input.unit/fce/input.interface.js'
import { InputModel } from './84.input.unit/input.model.js'
import Collect from './97.collect.unit/fce/collect.interface.js'
import { CollectModel } from './97.collect.unit/collect.model.js'
import Menu from './98.menu.unit/fce/menu.interface.js'
import { MenuModel } from './98.menu.unit/menu.model.js'
import Bus from './99.bus.unit/fce/bus.interface.js'
import Sync from './25.sync.unit/fce/sync.interface.js'
import { BusModel } from './99.bus.unit/bus.model.js'
import { SyncModel } from './25.sync.unit/sync.model.js'

export const list: Array<any> = [
    AssetsaudioUnit,
    VoiceUnit,
    FoleyUnit,
    MusicUnit,
    FilterUnit,
    RedactionUnit,
    DeesserUnit,
    ComplianceUnit,
    InputUnit,
    CollectUnit,
    MenuUnit,
    BusUnit,
    SyncUnit,
]

import * as reduceFromAssetsaudio from './00.assetsaudio.unit/assetsaudio.reduce.js'
import * as reduceFromVoice from './01.voice.unit/voice.reduce.js'
import * as reduceFromFoley from './02.foley.unit/foley.reduce.js'
import * as reduceFromMusic from './03.music.unit/music.reduce.js'
import * as reduceFromFilter from './11.filter.unit/filter.reduce.js'
import * as reduceFromRedaction from './14.redaction.unit/redaction.reduce.js'
import * as reduceFromDeesser from './16.deesser.unit/deesser.reduce.js'
import * as reduceFromCompliance from './24.compliance.unit/compliance.reduce.js'
import * as reduceFromInput from './84.input.unit/input.reduce.js'
import * as reduceFromCollect from './97.collect.unit/collect.reduce.js'
import * as reduceFromMenu from './98.menu.unit/menu.reduce.js'
import * as reduceFromBus from './99.bus.unit/bus.reduce.js'
import * as reduceFromSync from './25.sync.unit/sync.reduce.js'

export const reducer: any = {
    assetsaudio: reduceFromAssetsaudio.reducer,
    voice: reduceFromVoice.reducer,
    foley: reduceFromFoley.reducer,
    music: reduceFromMusic.reducer,
    filter: reduceFromFilter.reducer,
    redaction: reduceFromRedaction.reducer,
    deesser: reduceFromDeesser.reducer,
    compliance: reduceFromCompliance.reducer,
    input: reduceFromInput.reducer,
    collect: reduceFromCollect.reducer,
    menu: reduceFromMenu.reducer,
    bus: reduceFromBus.reducer,
    sync: reduceFromSync.reducer,
}

export default class UnitData implements Model {
    assetsaudio: Assetsaudio = new AssetsAudioModel()
    voice: Voice = new VoiceModel()
    foley: Foley = new FoleyModel()
    music: Music = new MusicModel()
    filter: Filter = new FilterModel()
    redaction: Redaction = new RedactionModel()
    deesser: Deesser = new DeesserModel()
    compliance: Compliance = new ComplianceModel()
    input: Input = new InputModel()
    collect: Collect = new CollectModel()
    menu: Menu = new MenuModel()
    bus: Bus = new BusModel()
    sync: Sync = new SyncModel()
}
