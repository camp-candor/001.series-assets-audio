import type MusicBit from './fce/music.bit.js'

export interface Action<T = any> {
    type: string
    bale?: T
}

export const INIT_MUSIC = '[Music action] Init Music'
export class InitMusic implements Action<MusicBit> {
    readonly type = INIT_MUSIC
    constructor(public bale: MusicBit) {}
}

export const VALIDATE_MUSIC_MANIFEST = '[Music action] Validate Music Manifest'
export class ValidateMusicManifest implements Action<MusicBit> {
    readonly type = VALIDATE_MUSIC_MANIFEST
    constructor(public bale: MusicBit) {}
}

export const VERIFY_LOOP_BOUNDARIES = '[Music action] Verify Loop Boundaries'
export class VerifyLoopBoundaries implements Action<MusicBit> {
    readonly type = VERIFY_LOOP_BOUNDARIES
    constructor(public bale: MusicBit) {}
}

export const RESOLVE_MUSIC_STEM = '[Music action] Resolve Music Stem'
export class ResolveMusicStem implements Action<MusicBit> {
    readonly type = RESOLVE_MUSIC_STEM
    constructor(public bale: MusicBit) {}
}

export const REGISTER_MUSIC_STEM = '[Music action] Register Music Stem'
export class RegisterMusicStem implements Action<MusicBit> {
    readonly type = REGISTER_MUSIC_STEM
    constructor(public bale: MusicBit) {}
}

export const UPDATE_MUSIC = '[Music action] Update Music'
export class UpdateMusic implements Action<MusicBit> {
    readonly type = UPDATE_MUSIC
    constructor(public bale: MusicBit) {}
}

export type Actions =
    | InitMusic
    | ValidateMusicManifest
    | VerifyLoopBoundaries
    | ResolveMusicStem
    | RegisterMusicStem
    | UpdateMusic
