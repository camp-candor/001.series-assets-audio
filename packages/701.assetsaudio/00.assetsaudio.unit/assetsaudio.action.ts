import type AssetsAudioBit from './fce/assetsaudio.bit.js'

export interface Action<T = any> {
    type: string
    bale?: T
}

export const INIT_ASSETSAUDIO = '[AssetsAudio action] Init AssetsAudio'
export class InitAssetsAudio implements Action<AssetsAudioBit> {
    readonly type = INIT_ASSETSAUDIO
    constructor(public bale: AssetsAudioBit) {}
}

export const CONFIGURE_LFS = '[Lfs action] Configure Lfs'
export class ConfigureLfs implements Action<AssetsAudioBit> {
    readonly type = CONFIGURE_LFS
    constructor(public bale: AssetsAudioBit) {}
}

export const AUDIT_POISON_BUFFERS = '[Sentinel action] Audit Poison Buffers'
export class AuditPoisonBuffers implements Action<AssetsAudioBit> {
    readonly type = AUDIT_POISON_BUFFERS
    constructor(public bale: AssetsAudioBit) {}
}

export const SWEEP_STORAGE_QUOTAS = '[Sweeper action] Sweep Storage Quotas'
export class SweepStorageQuotas implements Action<AssetsAudioBit> {
    readonly type = SWEEP_STORAGE_QUOTAS
    constructor(public bale: AssetsAudioBit) {}
}

export const EXECUTE_MASTER_AUDIT = '[Master action] Execute Master Audit'
export class ExecuteMasterAudit implements Action<AssetsAudioBit> {
    readonly type = EXECUTE_MASTER_AUDIT
    constructor(public bale: AssetsAudioBit) {}
}

export const UPDATE_ASSETSAUDIO = '[AssetsAudio action] Update AssetsAudio'
export class UpdateAssetsAudio implements Action<AssetsAudioBit> {
    readonly type = UPDATE_ASSETSAUDIO
    constructor(public bale?: AssetsAudioBit) {}
}

export const TEST_ASSETSAUDIO = '[Test action] Test AssetsAudio'
export class TestAssetsAudio implements Action<AssetsAudioBit> {
    readonly type = TEST_ASSETSAUDIO
    constructor(public bale?: AssetsAudioBit) {}
}

export const LIST_ASSETSAUDIO = '[List action] List AssetsAudio'
export class ListAssetsAudio implements Action<AssetsAudioBit> {
    readonly type = LIST_ASSETSAUDIO
    constructor(public bale?: AssetsAudioBit) {}
}

export type Actions =
    | InitAssetsAudio
    | ConfigureLfs
    | AuditPoisonBuffers
    | SweepStorageQuotas
    | ExecuteMasterAudit
    | UpdateAssetsAudio
    | TestAssetsAudio
    | ListAssetsAudio
