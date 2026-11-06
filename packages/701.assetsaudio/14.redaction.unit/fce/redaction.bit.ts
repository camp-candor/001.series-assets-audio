export interface TemporalCadenceMetrics {
    consonantAttackVelocity: number // d(RMS)/dt at phonetic onsets (dB/ms)
    averageSyllableDurationMs: number
    pauseToSpeechRatio: number // P2SR
    rhythmEnergyVariance: number
}

export interface RedactionAuditReport {
    filePath: string
    isTimbreStripped: boolean
    flattenedPitchHz: number
    formantsSuppressed: boolean
    metrics: TemporalCadenceMetrics
    detectedCadenceStyle: string
    cadenceMatchConfidence: number // P(Identity) [0.0, 1.0]
    status: 'PASSED' | 'FAILED'
    error?: string
}

export default interface RedactionBit<TDat = unknown, TLst = string> {
    idx: string
    src?: string
    lst?: TLst[]
    val?: number
    dat?: TDat
    slv?: (result: { redBit: Partial<RedactionBit<TDat, TLst>> }) => void
}
