import * as fs from 'fs-extra';

export const authorVocalDirectionNotes = async (noteText: string, characterId: string) => {
    const isAscii = /^[\x20-\x7E\r\n\t]+$/.test(noteText);
    if (!isAscii) {
        throw new Error('NON_ASCII_DIRECTION_NOTE_BREACH');
    }

    // Pseudo implementation for saving
    const telemetry = `>> [VOICE:NOTES:SAVED]`;
    if (global.LIBRARY) {
        await global.LIBRARY.hunt('[Write action] Write Console', {
            idx: 'cns00',
            src: telemetry,
        });
    }
};
