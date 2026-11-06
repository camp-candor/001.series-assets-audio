import type VoiceBit from './fce/voice.bit.js'

export interface Action<T = any> {
    type: string
    bale?: T
}

export const INIT_VOICE = '[Voice action] Init Voice'
export class InitVoice implements Action<VoiceBit> {
    readonly type = INIT_VOICE
    constructor(public bale: VoiceBit) {}
}

export const SCAFFOLD_VAULT = '[Vault action] Scaffold Vault'
export class ScaffoldVault implements Action<VoiceBit> {
    readonly type = SCAFFOLD_VAULT
    constructor(public bale: VoiceBit) {}
}

export const SYNC_FLOATING_SYMLINKS = '[Symlink action] Sync Floating Symlinks'
export class SyncFloatingSymlinks implements Action<VoiceBit> {
    readonly type = SYNC_FLOATING_SYMLINKS
    constructor(public bale: VoiceBit) {}
}

export const PROVISION_SERIES_PARTITION =
    '[Partition action] Provision Series Partition'
export class ProvisionSeriesPartition implements Action<VoiceBit> {
    readonly type = PROVISION_SERIES_PARTITION
    constructor(public bale: VoiceBit) {}
}

export const ASSERT_LIKENESS_QUARANTINE =
    '[Quarantine action] Assert Likeness Quarantine'
export class AssertLikenessQuarantine implements Action<VoiceBit> {
    readonly type = ASSERT_LIKENESS_QUARANTINE
    constructor(public bale: VoiceBit) {}
}

export type Actions =
    | InitVoice
    | ScaffoldVault
    | SyncFloatingSymlinks
    | ProvisionSeriesPartition
    | AssertLikenessQuarantine
