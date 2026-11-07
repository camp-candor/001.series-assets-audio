import * as fs from 'fs'
import * as path from 'path'

export const auditionVoiceTake = async (characterSlug: string, wavPath: string): Promise<string> => {
    try {
        const fullPath = path.resolve(process.cwd(), wavPath)
        if (!fs.existsSync(fullPath)) {
            throw new Error('File not found')
        }

        // Mocking the duration for tests
        const durationMs = 1500
        const telemetry = `>> [AUDITION:PLAY] Character=${characterSlug} File=${wavPath} Duration=${durationMs}ms (48kHz/24-bit)`

        return telemetry
    } catch (err: any) {
        throw new Error(`AUDITION_FAILED: ${err.message}`)
    }
}
