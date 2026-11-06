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

export const REGISTER_CONDITION_VARIANT =
    '[Condition action] Register Condition Variant'
export class RegisterConditionVariant implements Action<VoiceBit> {
    readonly type = REGISTER_CONDITION_VARIANT
    constructor(public bale: VoiceBit) {}
}

export const RETARGET_CONDITION_SYMLINK =
    '[Condition action] Retarget Condition Symlink'
export class RetargetConditionSymlink implements Action<VoiceBit> {
    readonly type = RETARGET_CONDITION_SYMLINK
    constructor(public bale: VoiceBit) {}
}

export const AUDIT_CONDITION_VAULT = '[Condition action] Audit Condition Vault'
export class AuditConditionVault implements Action<VoiceBit> {
    readonly type = AUDIT_CONDITION_VAULT
    constructor(public bale: VoiceBit) {}
}

export const UPDATE_VOICE = '[Voice action] Update Voice'
export class UpdateVoice implements Action<VoiceBit> {
    readonly type = UPDATE_VOICE
    constructor(public bale: VoiceBit) {}
}

export const VALIDATE_LEGAL_CLEARANCE_TOKEN =
    '[Legal action] Validate Legal Clearance Token'
export class ValidateLegalClearanceToken implements Action<VoiceBit> {
    readonly type = VALIDATE_LEGAL_CLEARANCE_TOKEN
    constructor(public bale: VoiceBit) {}
}

export const VALIDATE_VOICE_MANIFEST = '[Voice action] Validate Voice Manifest'
export class ValidateVoiceManifest implements Action<VoiceBit> {
    readonly type = VALIDATE_VOICE_MANIFEST
    constructor(public bale: VoiceBit) {}
}

export const RESOLVE_CHARACTER_VOICE = '[Voice action] Resolve Character Voice'
export class ResolveCharacterVoice implements Action<VoiceBit> {
    readonly type = RESOLVE_CHARACTER_VOICE
    constructor(public bale: VoiceBit) {}
}

export const VALIDATE_LEXICON = '[Voice action] Validate Lexicon'
export class ValidateLexicon implements Action<VoiceBit> {
    readonly type = VALIDATE_LEXICON
    constructor(public bale: VoiceBit) {}
}

export const VERIFY_SYMLINK_INTEGRITY =
    '[Voice action] Verify Symlink Integrity'
export class VerifySymlinkIntegrity implements Action<VoiceBit> {
    readonly type = VERIFY_SYMLINK_INTEGRITY
    constructor(public bale: VoiceBit) {}
}

export const AUDIT_ORPHAN_TAKES = '[Voice action] Audit Orphan Takes'
export class AuditOrphanTakes implements Action<VoiceBit> {
    readonly type = AUDIT_ORPHAN_TAKES
    constructor(public bale: VoiceBit) {}
}

export const REGISTER_VOICE_TAKE = '[Voice action] Register Voice Take'
export class RegisterVoiceTake implements Action<VoiceBit> {
    readonly type = REGISTER_VOICE_TAKE
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
    | RegisterConditionVariant
    | RetargetConditionSymlink
    | AuditConditionVault
    | UpdateVoice
    | ValidateLegalClearanceToken
    | ValidateVoiceManifest
    | ResolveCharacterVoice
    | ValidateLexicon
    | VerifySymlinkIntegrity
    | AuditOrphanTakes
    | RegisterVoiceTake
