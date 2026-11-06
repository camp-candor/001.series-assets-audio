export interface DeesserMetrics {
    sibilantEnergyDbfs: number
    maxReductionDb: number
    clampedUltrasonicFrequencies: boolean
}

export interface DeesserReport {
    filePath: string
    attenuationApplied: boolean
    metrics: DeesserMetrics
    status: 'PASSED' | 'FAILED'
    error?: string
}

export default interface DeesserBit<TDat = unknown, TLst = string> {
    idx: string
    src?: string
    lst?: TLst[]
    val?: number
    dat?: TDat
    slv?: (result: { desBit: Partial<DeesserBit<TDat, TLst>> }) => void
}
