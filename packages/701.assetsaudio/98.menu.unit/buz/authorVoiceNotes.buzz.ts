import * as fs from 'fs'
import * as path from 'path'

export const authorVocalDirectionNotes = async (characterSlug: string, noteText: string): Promise<void> => {
    if (!/^[\x20-\x7E\r\n\t]+$/.test(noteText)) {
        throw new Error('NON_ASCII_DIRECTION_NOTE_BREACH')
    }

    // In a real app we'd update voices/voice_manifest.json here

    return
}
