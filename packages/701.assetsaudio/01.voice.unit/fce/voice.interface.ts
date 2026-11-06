import type VoiceBit from './voice.bit.js'

export default interface Voice {
    idx: string
    voicesRoot: string
    activeVersionsCount: number
}
