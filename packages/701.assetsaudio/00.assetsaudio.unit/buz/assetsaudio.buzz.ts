import { AssetsaudioModel } from '../assetsaudio.model.js'
import AssetsaudioBit from '../fce/assetsaudio.bit.js'
import State from '../../99.core/state.js'

const assetsaudio = {
    list: async () => {
        return { models: [] as any[] }
    },
}

export const initAssetsaudio = (
    cpy: AssetsaudioModel,
    bal: AssetsaudioBit,
    ste: State,
) => {
    const url =
        process.env.ASSETSAUDIO_URL ||
        'https://zero00-assetsaudio.onrender.com/api/assetsaudio/test'
    if (url) {
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                if (bal.slv != null) {
                    bal.slv({
                        intBit: {
                            idx: 'init-assetsaudio',
                            dat: {
                                assetsaudio: data,
                            },
                        },
                    })
                }
            })
            .catch((error: any) => {
                if (bal.slv != null) {
                    bal.slv({
                        intBit: {
                            idx: 'init-assetsaudio-err',
                            dat: error.message,
                        },
                    })
                }
            })
    } else {
        if (bal.slv != null) {
            bal.slv({ intBit: { idx: 'init-assetsaudio' } })
        }
    }
    return cpy
}

export const updateAssetsaudio = (
    cpy: AssetsaudioModel,
    bal: AssetsaudioBit,
    ste: State,
) => {
    bal.slv({ intBit: { idx: 'update-assetsaudio' } })

    return cpy
}

export const testAssetsaudio = (
    cpy: AssetsaudioModel,
    bal: AssetsaudioBit,
    ste: State,
) => {
    bal.slv({ mytBit: { idx: 'test-assetsaudio', val: 1 } })
    return cpy
}

export const listAssetsaudio = async (
    cpy: AssetsaudioModel,
    bal: AssetsaudioBit,
    ste: State,
) => {
    const response = await assetsaudio.list()
    if (bal.slv != null)
        bal.slv({
            olmBit: {
                idx: 'list-assetsaudio',
                lst: response.models.map((m: any) => m.name),
            },
        })
    return cpy
}
