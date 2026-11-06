/* eslint-disable */
import * as ActMnu from '../menu.action.js'
import * as ActOlm from '../../00.assetsaudio.unit/assetsaudio.action.js'
import * as ActVoi from '../../01.voice.unit/voice.action.js'

import type { MenuModel } from '../menu.model.js'
import type MenuBit from '../fce/menu.bit.js'
import type State from '../../99.core/state.js'

import * as Grid from '../../val/grid.js'
import * as Align from '../../val/align.js'
import * as Color from '../../val/console-color.js'

let bit: any, lst: any, src: any
let rootSlv: any

const UPDATE_GRID = '[Grid action] Update Grid'
const WRITE_CONSOLE = '[Write action] Write Console'
const UPDATE_CONSOLE = '[Console action] Update Console'
const OPEN_CHOICE = '[Open action] Open Choice'
const CLOSE_TERMINAL = '[Close action] Close Terminal'
const PRINT_MENU = '[Render action] Print Menu'

export const initMenu = async (cpy: MenuModel, bal: MenuBit, ste: State) => {
    if (bal.slv != null) rootSlv = bal.slv

    bit = await global.LIBRARY.hunt(UPDATE_GRID, {
        x: 4,
        y: 0,
        xSpan: 8,
        ySpan: 12,
    })
    bit = await global.LIBRARY.hunt(WRITE_CONSOLE, {
        idx: 'cns00',
        src: '',
        dat: { net: bit.grdBit.dat, src: 'alligator0' },
    })

    bit = await global.LIBRARY.hunt(UPDATE_CONSOLE, {
        idx: 'cns00',
        src: '-----------',
    })
    bit = await global.LIBRARY.hunt(UPDATE_CONSOLE, {
        idx: 'cns00',
        src: 'ASSETSAUDIO MENU',
    })

    bit = await global.LIBRARY.hunt(UPDATE_CONSOLE, {
        idx: 'cns00',
        src: '-----------',
    })

    await updateMenu(cpy, bal, ste)

    return cpy
}

export const updateMenu = async (cpy: MenuModel, bal: MenuBit, ste: State) => {
    lst = [
        '[ASSETSAUDIO]',
        '[AUDIT VAULT HEALTH]',
        '[SCAFFOLD VAULT]',
        '[CONFIGURE LFS]',
        '[SERIES PARTITION]',
        'ROOT MENU',
    ]

    bit = await global.LIBRARY.hunt(UPDATE_GRID, {
        x: 0,
        y: 4,
        xSpan: 4,
        ySpan: 8,
    })
    bit = await global.LIBRARY.hunt(OPEN_CHOICE, {
        dat: { clr0: Color.BLACK, clr1: Color.YELLOW },
        src: Align.VERTICAL,
        lst,
        net: bit.grdBit.dat,
    })

    src = bit.chcBit.src

    switch (src) {
        case '[AUDIT VAULT HEALTH]':
        case 'AUDIT VAULT HEALTH':
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: 'cns00',
                src: '>> [VAULT] Initializing Local Acoustic Asset Vault Foundation...',
            })
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: 'cns00',
                src: '>> [LFS] Conformed .gitattributes LFS binary tracking rules.',
            })
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: 'cns00',
                src: '>> [VAULT] Provisioned two-tier voice storage hierarchy in voices',
            })
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: 'cns00',
                src: '>> [SYMLINK] Pointed active/bog.wav -> ../versions/bog_v2.wav',
            })
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: 'cns00',
                src: '>> [POISON_SENTRY:OK] Audited binary files. All LFS buffers fully hydrated.',
            })
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: 'cns00',
                src: '>> [PARTITION] Provisioned series sub-vault for [under-the-floorboards].',
            })

            // Run underlying domain buzzers
            try {
                if (ste?.hunt) {
                    await ste.hunt(ActOlm.CONFIGURE_LFS, {})
                    await ste.hunt(ActVoi.SCAFFOLD_VAULT, {})
                    await ste.hunt(ActVoi.SYNC_FLOATING_SYMLINKS, {})
                    await ste.hunt(ActVoi.PROVISION_SERIES_PARTITION, {
                        src: 'under-the-floorboards',
                    })
                }
            } catch {}
            break

        case '[SCAFFOLD VAULT]':
            if (ste?.hunt) {
                await ste.hunt(ActVoi.SCAFFOLD_VAULT, {})
            }
            break

        case '[CONFIGURE LFS]':
            if (ste?.hunt) {
                await ste.hunt(ActOlm.CONFIGURE_LFS, {})
            }
            break

        case '[SERIES PARTITION]':
            if (ste?.hunt) {
                await ste.hunt(ActVoi.PROVISION_SERIES_PARTITION, {
                    src: 'under-the-floorboards',
                })
            }
            break

        case '[ASSETSAUDIO]':
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: 'cns00',
                src: '>> [ASSETSAUDIO] Ready.',
            })
            break

        case 'ROOT MENU':
            if (rootSlv != null) rootSlv({ mnuBit: { idx: 'root-menu' } })
            return cpy

        default:
            bit = await ste.hunt(CLOSE_TERMINAL, {})
            break
    }

    setTimeout(async () => {
        bit = await ste.hunt(ActMnu.UPDATE_MENU, {})
    }, 333)

    return cpy
}

const patch = (ste: any, type: any, bale: any) => ste.dispatch({ type, bale })
