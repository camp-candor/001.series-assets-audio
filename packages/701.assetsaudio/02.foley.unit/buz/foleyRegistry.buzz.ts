import type { FoleyModel } from '../foley.model.js'
import type FoleyBit from '../fce/foley.bit.js'

export const initFoley = async (
    cpy: FoleyModel,
    bal: FoleyBit,
    ste?: any,
): Promise<FoleyModel> => {
    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: '>> [FOLEY] Transient Foley Registry Unit Initialized.',
            })
            .catch(() => {})
    }
    if (bal?.slv) {
        bal.slv({
            foleyBit: { idx: 'init-foley', val: 0 },
        })
    }
    return cpy
}
