import type Deesser from './fce/deesser.interface.js'
import type { DeesserReport } from './fce/deesser.bit.js'

export class DeesserModel implements Deesser {
    idx = '16.deesser'
    thresholdDbfs = -18.0
    ratio = 4.0
    attackMs = 1.0
    releaseMs = 20.0
    lastDeesserReport: DeesserReport | null = null
}

export default DeesserModel
