import type AssetsAudioBit from './assetsaudio.bit.js'

export default interface AssetsAudio {
    idx: string
    vaultRoot: string
    lfsInitialized: boolean
    totalVaultBytes: number
    trackedMediaFiles: number
}
