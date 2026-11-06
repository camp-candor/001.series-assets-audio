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

export const VALIDATE_SOURCE_INODE = '[Voice action] Validate Source Inode'
export class ValidateSourceInode implements Action<VoiceBit> {
    readonly type = VALIDATE_SOURCE_INODE
    constructor(public bale: VoiceBit) {}
}

export const MATCH_EXISTING_CHARACTER =
    '[Character action] Match Existing Character'
export class MatchExistingCharacter implements Action<VoiceBit> {
    readonly type = MATCH_EXISTING_CHARACTER
    constructor(public bale: VoiceBit) {}
}

export const SCAFFOLD_NEW_CHARACTER =
    '[Character action] Scaffold New Character'
export class ScaffoldNewCharacter implements Action<VoiceBit> {
    readonly type = SCAFFOLD_NEW_CHARACTER
    constructor(public bale: VoiceBit) {}
}

export const RESOLVE_MONOTONIC_VERSION =
    '[Version action] Resolve Monotonic Version'
export class ResolveMonotonicVersion implements Action<VoiceBit> {
    readonly type = RESOLVE_MONOTONIC_VERSION
    constructor(public bale: VoiceBit) {}
}

export const CONFIGURE_VOICE_RECIPE = '[Voice action] Configure Voice Recipe'
export class ConfigureVoiceRecipe implements Action<VoiceBit> {
    readonly type = CONFIGURE_VOICE_RECIPE
    constructor(public bale: VoiceBit) {}
}

export const COMMIT_RECIPE_TO_MANIFEST =
    '[Voice action] Commit Recipe To Manifest'
export class CommitRecipeToManifest implements Action<VoiceBit> {
    readonly type = COMMIT_RECIPE_TO_MANIFEST
    constructor(public bale: VoiceBit) {}
}

export const EXECUTE_TWO_TIER_PROMOTION =
    '[Voice action] Execute Two Tier Promotion'
export class ExecuteTwoTierPromotion implements Action<VoiceBit> {
    readonly type = EXECUTE_TWO_TIER_PROMOTION
    constructor(public bale: VoiceBit) {}
}

export const ASSERT_BANNED_CADENCE = '[Voice action] Assert Banned Cadence'
export class AssertBannedCadence implements Action<VoiceBit> {
    readonly type = ASSERT_BANNED_CADENCE
    constructor(public bale: VoiceBit) {}
}

export type Actions =
    | InitVoice
    | ScaffoldVault
    | SyncFloatingSymlinks
    | ProvisionSeriesPartition
    | AssertLikenessQuarantine
    | ValidateSourceInode
    | MatchExistingCharacter
    | ScaffoldNewCharacter
    | ResolveMonotonicVersion
    | ConfigureVoiceRecipe
    | CommitRecipeToManifest
    | ExecuteTwoTierPromotion
    | AssertBannedCadence
