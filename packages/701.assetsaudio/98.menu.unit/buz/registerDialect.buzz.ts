export const registerDialectOverride = async (word: string, arpabet: string, ipa: string): Promise<void> => {
    if (!/^[A-Z0-2\s]+$/.test(arpabet)) {
        throw new Error('INVALID_ARPABET_PHONEME_BREACH')
    }
    if (!/^[\x20-\x7E]+$/.test(ipa)) {
        throw new Error('INVALID_ARPABET_PHONEME_BREACH')
    }

    return
}
