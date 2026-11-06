export interface FilterMetrics {
    originalMean: number
    correctedMean: number
    subBassAttenuationDb: number
    notch50HzDepthDb: number
    notch60HzDepthDb: number
}

export interface FilterReport {
    filePath: string
    isClean: boolean
    metrics: FilterMetrics
    status: 'PASSED' | 'FAILED'
    error?: string
}

export default interface FilterBit<TDat = unknown, TLst = string> {
    idx: string
    src?: string
    lst?: TLst[]
    val?: number
    dat?: TDat
    slv?: (result: { filBit: Partial<FilterBit<TDat, TLst>> }) => void
}
