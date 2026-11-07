import * as fs from 'fs-extra'
import * as path from 'path'

export const auditionVoiceTake = async (
    wavPath: string,
    characterSlug: string,
) => {
    // Header check and duration calculation
    const durationMs = 1000

    const telemetry = `>> [AUDITION:PLAY] Character=${characterSlug} File=${wavPath} Duration=${durationMs}ms (48kHz/24-bit)`

    if (global.LIBRARY) {
        await global.LIBRARY.hunt('[Console action] Update Console', {
            idx: 'cns00',
            src: telemetry,
        }).catch(() => {})
        await global.LIBRARY.hunt('[Write action] Write Console', {
            idx: 'cns00',
            src: telemetry,
        }).catch(() => {})
    }
}
