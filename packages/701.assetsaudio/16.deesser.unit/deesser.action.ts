import type DeesserBit from './fce/deesser.bit.js'

export interface Action<T = any> {
    type: string
    bale?: T
}

export const INIT_DEESSER = '[Deesser action] Init Deesser'
export class InitDeesser implements Action<DeesserBit> {
    readonly type = INIT_DEESSER
    constructor(public bale: DeesserBit) {}
}

export const ATTENUATE_SIBILANCE = '[Deesser action] Attenuate Sibilance'
export class AttenuateSibilance implements Action<DeesserBit> {
    readonly type = ATTENUATE_SIBILANCE
    constructor(public bale: DeesserBit) {}
}

export type Actions = InitDeesser | AttenuateSibilance
