import fs from 'fs-extra'
import path from 'path'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type { SeriesPartitionConfig } from '../fce/voice.bit.js'

export const provisionSeriesPartition = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const rootDir = cpy.voicesRoot
    const seriesSlug = (
        bal?.src ||
        (bal?.dat as any)?.seriesSlug ||
        'under-the-floorboards'
    ).trim()
    const partitionRoot = path.resolve(rootDir, 'voices', seriesSlug)

    const lexiconPath = path.join(partitionRoot, 'lexicon.json')
    const manifestPath = path.join(partitionRoot, 'voice_manifest.json')

    await fs.ensureDir(partitionRoot)

    if (!(await fs.pathExists(lexiconPath))) {
        const defaultLexicon = {
            $schema: 'https://campcandor.com/schemas/lexicon.v1.json',
            series: seriesSlug,
            g2p_rules: {},
            dialect_overrides: {},
            banned_pronunciations: [],
        }
        await fs.writeJson(lexiconPath, defaultLexicon, { spaces: 2 })
    }

    if (!(await fs.pathExists(manifestPath))) {
        const defaultManifest = {
            $schema: 'https://campcandor.com/schemas/voice_manifest.v1.json',
            series: seriesSlug,
            schema_version: 1,
            voices: {},
        }
        await fs.writeJson(manifestPath, defaultManifest, { spaces: 2 })
    }

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [PARTITION] Provisioned series sub-vault for [${seriesSlug}].`,
            })
            .catch(() => {})
    }

    const config: SeriesPartitionConfig = {
        seriesSlug,
        partitionRoot,
        lexiconPath,
        manifestPath,
    }

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'provision-series-partition',
                val: 1,
                dat: config,
                src: partitionRoot,
            },
        })
    }

    return cpy
}

export const assertLikenessQuarantine = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const targetSeries = (bal?.dat as any)?.targetSeries
    const requestedSeries = (bal?.dat as any)?.requestedSeries
    const characterSlug = (bal?.dat as any)?.characterSlug

    if (targetSeries && requestedSeries && targetSeries !== requestedSeries) {
        const errorMsg = `LEGAL_CLEARANCE_BREACH: Cross-series voice borrowing prohibited. Character [${characterSlug}] belonging to [${requestedSeries}] cannot be consumed in [${targetSeries}].`
        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: `:: [QUARANTINE:FAIL] ${errorMsg}`,
                })
                .catch(() => {})
        }

        const breachError = new Error(errorMsg)
        if (bal?.slv) {
            bal.slv({
                voiBit: {
                    idx: 'assert-likeness-quarantine-fail',
                    val: -1,
                    src: characterSlug,
                    dat: { error: errorMsg },
                },
            })
        }
        throw breachError
    }

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [QUARANTINE:OK] Character [${characterSlug}] authorized within series scope [${targetSeries}].`,
            })
            .catch(() => {})
    }

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'assert-likeness-quarantine',
                val: 0,
                src: characterSlug,
            },
        })
    }

    return cpy
}
