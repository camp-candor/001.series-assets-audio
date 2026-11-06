export interface ConditionVariantRegistrationPayload {
    characterSlug: string
    conditionTag: string
    somaticTrigger?: string
    description?: string
    dspOverrides?: Record<string, number>
}

export interface ConditionProfileSummary {
    conditionTag: string
    activeVersion: string
    versionNumber: number
    fileName: string
    symlinkPath: string
    targetRelativePath: string
    sha256: string
    somaticTrigger?: string
    hasEmbedding: boolean
}

export interface ConditionVaultAuditResult {
    characterSlug: string
    isConsistent: boolean
    conditionsAudited: ConditionProfileSummary[]
    missingVersions: string[]
    missingEmbeddings: string[]
    brokenSymlinks: string[]
    discrepancies: string[]
}
