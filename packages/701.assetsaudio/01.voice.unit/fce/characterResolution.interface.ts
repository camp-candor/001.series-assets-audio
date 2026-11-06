export interface CharacterProfileSummary {
    characterSlug: string
    displayName: string
    baseState: string
    latestVersion: number
    latestVersionTag: string
    registeredConditions: string[]
    isExisting: boolean
}

export interface CharacterRegistrationPayload {
    characterSlug: string
    displayName: string
    seriesSlug?: string
    somaticNotes?: string
}

export interface VersionResolutionOptions {
    characterSlug: string
    conditionTag?: string
    requestedVersion?: number
}

export interface VersionResolutionResult {
    characterSlug: string
    currentVersion: number
    currentVersionTag: string
    nextVersion: number
    nextVersionTag: string
    targetFileName: string
    isNewCharacter: boolean
}
