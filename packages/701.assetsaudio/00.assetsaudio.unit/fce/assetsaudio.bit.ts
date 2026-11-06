export interface LfsTrackingRule {
    extension: string
    filter: string
    requiredByteMinimum: number
}

export interface PoisonAuditReport {
    filePath: string
    byteSize: number
    sha256: string
    isHydrated: boolean
    status: 'PASSED' | 'FAILED'
    error?: string
}

export interface StorageQuotaReport {
    vaultRoot: string
    totalVaultBytes: number
    trackedMediaFiles: number
    quotaCeilingBytes: number
    quotaWarningBytes: number
    percentageUsed: number
    status: 'HEALTHY' | 'APPROACHING_CEILING' | 'EXCEEDED'
    subdirectories: Record<string, { bytes: number; files: number }>
    timestamp: string
}

export interface MasterAuditReport {
    lfsConfigured: boolean
    poisonBufferAudit: {
        passed: boolean
        inspectedFiles: number
        failedFiles: number
    }
    storageQuotaAudit: StorageQuotaReport
    subVaultIntegrity: {
        versionsPresent: boolean
        activePresent: boolean
        embeddingsPresent: boolean
    }
    overallStatus: 'HEALTHY' | 'DEGRADED' | 'QUOTA_EXCEEDED'
    timestamp: string
}

export default interface AssetsAudioBit<TDat = unknown, TLst = string> {
    idx: string
    src?: string
    lst?: TLst[]
    val?: number
    dat?: TDat
    slv?: (result: { asbBit: Partial<AssetsAudioBit<TDat, TLst>> }) => void
}
