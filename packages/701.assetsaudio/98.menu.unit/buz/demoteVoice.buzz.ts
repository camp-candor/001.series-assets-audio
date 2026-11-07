export const demoteActiveVoiceVersion = async (characterSlug: string, targetFallbackVersion: number): Promise<void> => {
    if (targetFallbackVersion < 1) {
        throw new Error('VOICE_DEMOTION_NO_FALLBACK_BREACH')
    }
    return
}
