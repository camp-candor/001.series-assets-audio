import * as fs from 'fs-extra';
import * as path from 'path';

export const auditionVoiceTake = async (wavPath: string, characterSlug: string) => {
    // Dummy implementation for checking header and getting duration
    const durationMs = 1000;

    const telemetry = `>> [AUDITION:PLAY] Character=${characterSlug} File=${wavPath} Duration=${durationMs}ms (48kHz/24-bit)`;

    if (global.LIBRARY) {
        await global.LIBRARY.hunt('[Write action] Write Console', {
            idx: 'cns00',
            src: telemetry,
        });
    }
};
