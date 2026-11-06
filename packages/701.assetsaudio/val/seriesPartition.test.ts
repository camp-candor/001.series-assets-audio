import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import {
    provisionSeriesPartition,
    assertLikenessQuarantine,
} from '../01.voice.unit/buz/seriesPartition.buzz.js'
import { VoiceModel } from '../01.voice.unit/voice.model.js'

describe('Series Partition Quarantine Tests', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_series_partition')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(testRoot)
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    it('provisions series sub-vault with default lexicon and manifest', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        let slvResult: any = null
        const bit: any = {
            idx: 'provision-partition',
            src: 'wiregrass-basin',
            slv: (res: any) => {
                slvResult = res
            },
        }

        await provisionSeriesPartition(model, bit)

        expect(slvResult).toBeDefined()
        const partitionDir = path.join(testRoot, 'voices', 'wiregrass-basin')
        expect(
            await fs.pathExists(path.join(partitionDir, 'lexicon.json')),
        ).toBe(true)
        expect(
            await fs.pathExists(path.join(partitionDir, 'voice_manifest.json')),
        ).toBe(true)
    })

    it('halts with LEGAL_CLEARANCE_BREACH when character crosses series boundary', async () => {
        const model = new VoiceModel()

        const bit: any = {
            idx: 'quarantine-check',
            dat: {
                characterSlug: 'bog',
                targetSeries: 'wiregrass-basin',
                requestedSeries: 'under-the-floorboards',
            },
        }

        await expect(assertLikenessQuarantine(model, bit)).rejects.toThrow(
            'LEGAL_CLEARANCE_BREACH',
        )
    })

    it('authorizes likeness access within native series scope', async () => {
        const model = new VoiceModel()

        let slvResult: any = null
        const bit: any = {
            idx: 'quarantine-check',
            dat: {
                characterSlug: 'bog',
                targetSeries: 'under-the-floorboards',
                requestedSeries: 'under-the-floorboards',
            },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await assertLikenessQuarantine(model, bit)
        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.val).toBe(0)
    })
})
