import * as fs from 'fs-extra'

export const registerDialectOverride = async (
    word: string,
    arpabet: string,
    ipa: string,
) => {
    // Validate
    if (arpabet === 'INVALID') {
        throw new Error('INVALID_ARPABET_PHONEME_BREACH')
    }

    const telemetry = `>> [LEXICON:REGISTERED]`
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
