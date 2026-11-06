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

export default interface AssetsAudioBit<TDat = unknown, TLst = string> {
    idx: string
    src?: string
    lst?: TLst[]
    val?: number
    dat?: TDat
    slv?: (result: any) => void
}
