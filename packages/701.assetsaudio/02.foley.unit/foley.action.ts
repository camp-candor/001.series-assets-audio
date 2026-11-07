import type FoleyBit from './fce/foley.bit.js'

export interface Action<T = any> {
    type: string
    bale?: T
}

export const INIT_FOLEY = '[Foley action] Init Foley'
export class InitFoley implements Action<FoleyBit> {
    readonly type = INIT_FOLEY
    constructor(public bale: FoleyBit) {}
}

export const VALIDATE_FOLEY_REGISTRY = '[Foley action] Validate Foley Registry'
export class ValidateFoleyRegistry implements Action<FoleyBit> {
    readonly type = VALIDATE_FOLEY_REGISTRY
    constructor(public bale: FoleyBit) {}
}

export const VERIFY_VARIATION_POOLS = '[Foley action] Verify Variation Pools'
export class VerifyVariationPools implements Action<FoleyBit> {
    readonly type = VERIFY_VARIATION_POOLS
    constructor(public bale: FoleyBit) {}
}

export const RESOLVE_FOLEY_CUE = '[Foley action] Resolve Foley Cue'
export class ResolveFoleyCue implements Action<FoleyBit> {
    readonly type = RESOLVE_FOLEY_CUE
    constructor(public bale: FoleyBit) {}
}

export const REGISTER_FOLEY_ASSET = '[Foley action] Register Foley Asset'
export class RegisterFoleyAsset implements Action<FoleyBit> {
    readonly type = REGISTER_FOLEY_ASSET
    constructor(public bale: FoleyBit) {}
}

export const UPDATE_FOLEY = '[Foley action] Update Foley'
export class UpdateFoley implements Action<FoleyBit> {
    readonly type = UPDATE_FOLEY
    constructor(public bale: FoleyBit) {}
}

export type Actions =
    | InitFoley
    | ValidateFoleyRegistry
    | VerifyVariationPools
    | ResolveFoleyCue
    | RegisterFoleyAsset
    | UpdateFoley
