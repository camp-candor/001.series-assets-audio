import type ComplianceBit from './fce/compliance.bit.js'

export interface Action<T = any> {
    type: string
    bale?: T
}

export const INIT_COMPLIANCE = '[Compliance action] Init Compliance'
export class InitCompliance implements Action<ComplianceBit> {
    readonly type = INIT_COMPLIANCE
    constructor(public bale: ComplianceBit) {}
}

export const PROBE_AUDIO_CONTAINER = '[Probe action] Probe Audio Container'
export class ProbeAudioContainer implements Action<ComplianceBit> {
    readonly type = PROBE_AUDIO_CONTAINER
    constructor(public bale: ComplianceBit) {}
}

export const CLASSIFY_SIGNAL_GEOMETRY =
    '[Classify action] Classify Signal Geometry'
export class ClassifySignalGeometry implements Action<ComplianceBit> {
    readonly type = CLASSIFY_SIGNAL_GEOMETRY
    constructor(public bale: ComplianceBit) {}
}

export type Actions =
    InitCompliance | ProbeAudioContainer | ClassifySignalGeometry
