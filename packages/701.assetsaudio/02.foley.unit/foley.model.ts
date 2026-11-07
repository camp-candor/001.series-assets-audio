import type Foley from './fce/foley.interface.js'

export class FoleyModel implements Foley {
    idx = '02.foley'
    foleyRoot = process.cwd()
    cuesRegistered = 0
    variantsVerified = 0
    lastResolutionStatus = ''
}

export default FoleyModel
