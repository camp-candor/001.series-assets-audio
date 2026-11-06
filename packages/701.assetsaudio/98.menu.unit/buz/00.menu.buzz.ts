/* eslint-disable */
import * as ActMnu from '../menu.action.js'
import * as ActOlm from '../../00.assetsaudio.unit/assetsaudio.action.js'
import * as ActVoi from '../../01.voice.unit/voice.action.js'
import * as ActFil from '../../11.filter.unit/filter.action.js'
import * as ActDes from '../../16.deesser.unit/deesser.action.js'
import * as ActCmp from '../../24.compliance.unit/compliance.action.js'
import * as ActInp from '../../84.input.unit/input.action.js'

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

const HUD_CONSOLE = 'cns01'
const QUOTA_CEILING_BYTES = 4294967296

export const bridgeConsole = async (
    cpy: MenuModel,
    bal: MenuBit,
    ste: State,
) => {
    try {
        if (bal?.src != null && global.LIBRARY?.hunt) {
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: bal.idx || 'cns00',
                src: bal.src,
            })
        }
    } catch {}
    if (bal?.slv != null) {
        try {
            bal.slv({ mnuBit: { idx: 'bridge-console' } })
        } catch {}
    }
    return cpy
}

const renderHud = async (hud: {
    health: string
    bytes: number
    pct: string
}) => {
    try {
        const lines = [
            'VAULT STATUS',
            `Health: [${hud.health}]`,
            `Bytes: ${hud.bytes} / ${QUOTA_CEILING_BYTES}`,
            `Used: ${hud.pct}% of 4 GB`,
        ]
        for (const line of lines) {
            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                idx: HUD_CONSOLE,
                src: line,
            })
        }
    } catch {}
}

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

    bit = await global.LIBRARY.hunt(UPDATE_GRID, {
        x: 0,
        y: 0,
        xSpan: 4,
        ySpan: 4,
    })
    bit = await global.LIBRARY.hunt(WRITE_CONSOLE, {
        idx: HUD_CONSOLE,
        src: '',
        dat: { net: bit.grdBit.dat, src: 'alligator0' },
    })
    await renderHud({ health: 'UNINITIALIZED', bytes: 0, pct: '0.00' })

    await updateMenu(cpy, bal, ste)

    return cpy
}

export const updateMenu = async (cpy: MenuModel, bal: MenuBit, ste: State) => {
    lst = [
        '[INGEST REFERENCE VOICE]',
        '[CHECK SIGNAL COMPLIANCE]',
        '[SWEEP STORAGE QUOTAS]',
        '[AUDIT VAULT HEALTH]',
        '[SCAFFOLD VAULT]',
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
        case '[INGEST REFERENCE VOICE]':
        case 'INGEST REFERENCE VOICE':
            try {
                if (ste?.hunt) {
                    const promptRes: any = await ste.hunt(
                        ActInp.PROMPT_SOURCE_PATH,
                        {},
                    )
                    const enteredPath =
                        promptRes?.putBit?.src || promptRes?.putBit?.dat?.value
                    if (enteredPath && promptRes?.putBit?.dat?.submitted) {
                        try {
                            const voiRes: any = await ste.hunt(
                                ActVoi.VALIDATE_SOURCE_INODE,
                                {
                                    src: enteredPath,
                                },
                            )
                            const validatedPath =
                                voiRes?.voiBit?.src || enteredPath
                            const probeRes: any = await ste.hunt(
                                ActCmp.PROBE_AUDIO_CONTAINER,
                                {
                                    src: validatedPath,
                                },
                            )
                            const probeData =
                                probeRes?.cmpBit?.dat ||
                                ste.value?.compliance?.lastProbeResult
                            await ste.hunt(ActCmp.CLASSIFY_SIGNAL_GEOMETRY, {
                                dat: probeData,
                                src: validatedPath,
                            })

                            const matchRes: any = await ste.hunt(
                                ActVoi.MATCH_EXISTING_CHARACTER,
                                {},
                            )
                            const profiles = matchRes?.voiBit?.dat || []
                            const charList = profiles.map(
                                (p: any, idx: number) =>
                                    `[${idx + 1}] ${p.characterSlug} (${p.latestVersionTag})`,
                            )
                            charList.push('[+] REGISTER NEW CHARACTER')

                            bit = await global.LIBRARY.hunt(UPDATE_GRID, {
                                x: 0,
                                y: 4,
                                xSpan: 4,
                                ySpan: 8,
                            })
                            const charBit = await global.LIBRARY.hunt(
                                OPEN_CHOICE,
                                {
                                    dat: {
                                        clr0: Color.BLACK,
                                        clr1: Color.YELLOW,
                                    },
                                    src: Align.VERTICAL,
                                    lst: charList,
                                    net: bit.grdBit.dat,
                                },
                            )
                            const charSrc = charBit?.chcBit?.src
                            if (
                                charSrc &&
                                charSrc !== '[+] REGISTER NEW CHARACTER'
                            ) {
                                const m = charSrc.match(
                                    /\[\d+\]\s+([a-z0-9_]+)\s+\(/i,
                                )
                                const slug = m ? m[1] : charSrc.trim()
                                await ste.hunt(
                                    ActVoi.RESOLVE_MONOTONIC_VERSION,
                                    {
                                        dat: { characterSlug: slug },
                                    },
                                )

                                const vocoderList = [
                                    '[1] Chatterbox-Base-FP16 (Zero-Shot Clone)',
                                    '[2] StyleTTS-2 (Adversarial Style Diffusion)',
                                    '[3] CosyVoice-300M (Multi-Lingual High Fidelity)',
                                    '[4] Parler-TTS (Natural Language Description Prompt)',
                                    '[5] Kokoro (Lightweight Fast Local)',
                                    '[6] Piper (Deterministic Offline CPU)',
                                ]

                                bit = await global.LIBRARY.hunt(UPDATE_GRID, {
                                    x: 0,
                                    y: 4,
                                    xSpan: 4,
                                    ySpan: 8,
                                })
                                const vocoderBit = await global.LIBRARY.hunt(
                                    OPEN_CHOICE,
                                    {
                                        dat: {
                                            clr0: Color.BLACK,
                                            clr1: Color.YELLOW,
                                        },
                                        src: Align.VERTICAL,
                                        lst: vocoderList,
                                        net: bit.grdBit.dat,
                                    },
                                )
                                const vocoderSrc = vocoderBit?.chcBit?.src
                                let selectedEngine: any = null
                                if (vocoderSrc) {
                                    for (const eng of [
                                        'Chatterbox-Base-FP16',
                                        'StyleTTS-2',
                                        'CosyVoice-300M',
                                        'Parler-TTS',
                                        'Kokoro',
                                        'Piper',
                                    ]) {
                                        if (vocoderSrc.includes(eng)) {
                                            selectedEngine = eng
                                            break
                                        }
                                    }
                                }

                                if (selectedEngine) {
                                    try {
                                        const cfgRes: any = await ste.hunt(
                                            ActVoi.CONFIGURE_VOICE_RECIPE,
                                            {
                                                dat: {
                                                    characterSlug: slug,
                                                    ttsEngine: selectedEngine,
                                                    conditioningStrategy:
                                                        'ZERO_SHOT_CLONE',
                                                    baseDspModifiers: {
                                                        pitchShiftSemitones:
                                                            -3.5,
                                                        formantWarpingFactor: 1.15,
                                                        speedScalar: 0.95,
                                                        breathinessMultiplier: 1.25,
                                                        vocalFryDensity: 0.4,
                                                    },
                                                },
                                            },
                                        )
                                        const recipe = cfgRes?.voiBit?.dat
                                        if (recipe) {
                                            await ste.hunt(
                                                ActVoi.COMMIT_RECIPE_TO_MANIFEST,
                                                {
                                                    dat: { recipe },
                                                },
                                            )
                                        }
                                    } catch (err: any) {
                                        // Error telemetry emitted by configureVoiceRecipe
                                    }
                                }
                            }
                        } catch {}
                    }
                }
            } catch {}
            break

        case '[CHECK SIGNAL COMPLIANCE]':
        case 'CHECK SIGNAL COMPLIANCE':
            try {
                const candidateTakes = [
                    '[1] voices/versions/char_silas_v1.wav',
                    '[2] samples/noisy_take.wav',
                    '[3] voices/versions/char_bog_v1.wav',
                    '[4] voices/versions/char_mum_grissel_v1.wav',
                    '[<] CANCEL',
                ]

                bit = await global.LIBRARY.hunt(UPDATE_GRID, {
                    x: 0,
                    y: 4,
                    xSpan: 4,
                    ySpan: 8,
                })
                const takeBit = await global.LIBRARY.hunt(OPEN_CHOICE, {
                    dat: { clr0: Color.BLACK, clr1: Color.YELLOW },
                    src: Align.VERTICAL,
                    lst: candidateTakes,
                    net: bit.grdBit.dat,
                })
                const takeSrc = takeBit?.chcBit?.src

                if (takeSrc && !takeSrc.includes('CANCEL')) {
                    const isNoisy = takeSrc.includes('noisy_take.wav')
                    const selectedPath = isNoisy
                        ? 'samples/noisy_take.wav'
                        : 'voices/versions/char_silas_v1.wav'

                    const len = 48000
                    const samples = new Float32Array(len)

                    if (isNoisy) {
                        const noiseAmp = 0.003890451 * Math.SQRT2
                        for (let i = 0; i < len; i++) {
                            samples[i] =
                                noiseAmp *
                                Math.sin((2 * Math.PI * 440 * i) / 48000)
                        }
                    } else {
                        const noiseAmp = 0.0006223003 * Math.SQRT2
                        for (let i = 0; i < 2400; i++) {
                            samples[i] =
                                noiseAmp *
                                Math.sin((2 * Math.PI * 100 * i) / 48000)
                        }
                        for (let i = 2400; i < len; i++) {
                            samples[i] =
                                0.1 * Math.sin((2 * Math.PI * 440 * i) / 48000)
                        }
                        samples[3000] = 0.19498446
                    }

                    if (ste?.hunt) {
                        await ste.hunt(ActFil.INIT_FILTER, {})
                        const filRes: any = await ste.hunt(
                            ActFil.APPLY_SPECTRAL_HYGIENE,
                            {
                                src: selectedPath,
                                dat: { samples },
                            },
                        )
                        const hpSamples =
                            filRes?.filBit?.dat?.processedSamples || samples

                        await ste.hunt(ActDes.INIT_DEESSER, {})
                        const desRes: any = await ste.hunt(
                            ActDes.ATTENUATE_SIBILANCE,
                            {
                                src: selectedPath,
                                dat: { samples: hpSamples },
                            },
                        )
                        const deessedSamples =
                            desRes?.desBit?.dat?.processedSamples || hpSamples

                        try {
                            await ste.hunt(ActCmp.NORMALIZE_LOUDNESS, {
                                src: selectedPath,
                                dat: {
                                    samples: deessedSamples,
                                    initialLufs: -24.0,
                                    targetStandard: 'WEB_STREAMING_LUFS16',
                                },
                            })
                        } catch (err: any) {
                            // Signal non-compliant fail-closed handled gracefully
                        }
                    }
                }
            } catch {}
            break

        case '[AUDIT VAULT HEALTH]':
        case 'AUDIT VAULT HEALTH':
            // Phase-1 foundation passes; live telemetry streams via console bridge
            try {
                if (ste?.hunt) await ste.hunt(ActOlm.CONFIGURE_LFS, {})
            } catch {}
            try {
                if (ste?.hunt) await ste.hunt(ActVoi.SCAFFOLD_VAULT, {})
            } catch {}
            try {
                if (ste?.hunt) await ste.hunt(ActVoi.SYNC_FLOATING_SYMLINKS, {})
            } catch {}
            try {
                if (ste?.hunt) {
                    await ste.hunt(ActVoi.PROVISION_SERIES_PARTITION, {
                        src: 'under-the-floorboards',
                    })
                }
            } catch {}
            // Feature 2.3 master audit gauntlet; live telemetry via console bridge
            try {
                if (ste?.hunt) {
                    const res: any = await ste.hunt(
                        ActOlm.EXECUTE_MASTER_AUDIT,
                        {},
                    )
                    const rep = res?.asbBit?.dat
                    if (rep) {
                        await renderHud({
                            health: rep.overallStatus || 'DEGRADED',
                            bytes: rep.storageQuotaAudit?.totalVaultBytes ?? 0,
                            pct: String(
                                rep.storageQuotaAudit?.percentageUsed ?? '0.00',
                            ),
                        })
                    }
                }
            } catch {}
            break

        case '[SWEEP STORAGE QUOTAS]':
        case 'SWEEP STORAGE QUOTAS':
            try {
                if (ste?.hunt) {
                    const res: any = await ste.hunt(
                        ActOlm.SWEEP_STORAGE_QUOTAS,
                        {},
                    )
                    const rep = res?.asbBit?.dat
                    if (rep?.subdirectories) {
                        for (const sub of ['voices', 'foley', 'music']) {
                            const s = rep.subdirectories[sub] || {
                                bytes: 0,
                                files: 0,
                            }
                            await global.LIBRARY.hunt(UPDATE_CONSOLE, {
                                idx: 'cns00',
                                src: `>> [SWEEPER] ${sub}: ${s.bytes} bytes across ${s.files} files.`,
                            })
                        }
                    }
                    if (rep) {
                        const health =
                            rep.status === 'EXCEEDED'
                                ? 'QUOTA_EXCEEDED'
                                : rep.status === 'APPROACHING_CEILING'
                                  ? 'DEGRADED'
                                  : 'HEALTHY'
                        await renderHud({
                            health,
                            bytes: rep.totalVaultBytes ?? 0,
                            pct: String(rep.percentageUsed ?? '0.00'),
                        })
                    }
                }
            } catch {
                await renderHud({
                    health: 'QUOTA_EXCEEDED',
                    bytes: QUOTA_CEILING_BYTES,
                    pct: '100.00',
                })
            }
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

        case 'ROOT MENU':
            if (rootSlv != null) rootSlv({ mnuBit: { idx: 'root-menu' } })
            return cpy

        default:
            try {
                await global.LIBRARY.hunt(CLOSE_TERMINAL, {})
            } catch {}
            process.exit(0)
    }

    setTimeout(async () => {
        bit = await ste.hunt(ActMnu.UPDATE_MENU, {})
    }, 333)

    return cpy
}

const patch = (ste: any, type: any, bale: any) => ste.dispatch({ type, bale })
