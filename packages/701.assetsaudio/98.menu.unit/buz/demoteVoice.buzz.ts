import * as fs from 'fs-extra';

export const demoteActiveVoiceVersion = async (characterSlug: string, targetFallbackVersion: number) => {
    if (targetFallbackVersion < 1) {
         throw new Error('VOICE_DEMOTION_NO_FALLBACK_BREACH');
    }

    const telemetry = `>> [VOICE:DEMOTE]`;
    if (global.LIBRARY) {
        await global.LIBRARY.hunt('[Write action] Write Console', {
            idx: 'cns00',
            src: telemetry,
        });
    }
};
