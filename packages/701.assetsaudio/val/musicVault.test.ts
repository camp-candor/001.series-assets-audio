import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHash } from 'crypto'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import * as musicBuzz from '../03.music.unit/buz/music.buzz.js'
import {
    auditVocalBandEnergy,
    verifySeamlessLoopZeroCrossing,
} from '../03.music.unit/buz/spectralLinter.buzz.js'
import { MusicModel } from '../03.music.unit/music.model.js'
import { reducer } from '../03.music.unit/music.reduce.js'
import * as Act from '../03.music.unit/music.action.js'
import type {
    MusicManifest,
    MusicStemDefinition,
} from '../03.music.unit/fce/music.interface.js'

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
)

const CANONICAL_STEMS: Record<string, { category: string; wav: string }> = {
    amb_diner_rain_hum: {
        category: 'ambient',
        wav: 'music/ambient/amb_diner_rain_hum.wav',
    },
    scr_wiregrass_tension_low: {
        category: 'score',
        wav: 'music/score/scr_wiregrass_tension_low.wav',
    },
    scr_parallax_revelation_pad: {
        category: 'score',
        wav: 'music/score/scr_parallax_revelation_pad.wav',
    },
}

const makeSte = () => {
    const lines: string[] = []
    return {
        lines,
        hunt: async (_type: string, bit: any) => {
            lines.push(String(bit?.src || ''))
        },
    }
}

const run = async (
    buzz: (cpy: MusicModel, bal: any, ste?: any) => Promise<MusicModel>,
    root: string,
    dat: any = {},
    ste?: any,
): Promise<any> => {
    const model = new MusicModel()
    model.musicRoot = root
    let out: any = null
    await buzz(model, { idx: 'test', dat, slv: (r: any) => (out = r) }, ste)
    return out?.musicBit
}

const loadManifest = (): MusicManifest =>
    fs.readJsonSync(path.join(repoRoot, 'music', 'manifest.json'))

describe('Parallax Dinner Music Vault :: canonical manifest and WAV stems', () => {
    const manifest = loadManifest()

    it('registers the ambient bed and two score stems with required fields', () => {
        expect(manifest.schema_version).toBe('1.0.0')
        expect(manifest.series_scope).toBe('the_parallax_dinner')
        expect(Object.keys(manifest.stems).sort()).toEqual(
            Object.keys(CANONICAL_STEMS).sort(),
        )
        for (const [stemId, expected] of Object.entries(CANONICAL_STEMS)) {
            const stem = manifest.stems[stemId]
            expect(stem, `missing stem ${stemId}`).toBeDefined()
            expect(stem.stem_id).toBe(stemId)
            expect(stem.category).toBe(expected.category)
            expect(stem.wav_path).toBe(expected.wav)
            expect(stem.sha256).toMatch(/^[a-f0-9]{64}$/)
            expect(stem.sample_rate_hz).toBe(48000)
            expect(stem.bit_depth).toBe(24)
            expect(stem.channels).toBe(1)
            expect(stem.duration_ms).toBeGreaterThan(0)
            expect(stem.loop_seamless).toBe(true)
            expect(stem.zero_crossing_delta).toBe(0)
            expect(stem.vocal_band_ceiling_dbfs).toBeLessThanOrEqual(-14)
            expect(stem.recommended_ducking_db).toBeLessThanOrEqual(-6)
        }
    })

    it('ships physical 48 kHz 24-bit WAV files with SHA parity and zero crossings', () => {
        for (const stem of Object.values(manifest.stems)) {
            const wavPath = path.join(repoRoot, stem.wav_path)
            expect(fs.existsSync(wavPath), `missing ${stem.wav_path}`).toBe(
                true,
            )
            const buffer = fs.readFileSync(wavPath)
            expect(buffer.length).toBeGreaterThan(1024)
            const digest = createHash('sha256').update(buffer).digest('hex')
            expect(digest).toBe(stem.sha256)

            const boundary = verifySeamlessLoopZeroCrossing(
                buffer,
                0.02,
                stem.stem_id,
            )
            expect(boundary.valid).toBe(true)
            expect(boundary.statusCode).toBe('MUSIC_STEM_COMPLIANT')
            expect(boundary.firstSampleNormalized).toBe(0)
            expect(boundary.lastSampleNormalized).toBe(0)
            expect(boundary.zeroCrossingDelta).toBe(0)
        }
    })

    it('validateMusicManifest clears all stems and emits MANIFEST:OK telemetry', async () => {
        const ste = makeSte()
        const res = await run(
            musicBuzz.validateMusicManifest,
            repoRoot,
            {},
            ste,
        )
        expect(res.val).toBe(0)
        expect(res.dat.valid).toBe(true)
        expect(res.dat.stemsValidated).toHaveLength(3)
        expect(res.dat.totalStems).toBe(3)
        expect(res.dat.breaches).toEqual([])
        expect(
            ste.lines.some((line) => line.startsWith('>> [MUSIC:MANIFEST:OK]')),
        ).toBe(true)
    })

    it('verifyLoopBoundaries clears the full manifest and a targeted stem', async () => {
        const all = await run(musicBuzz.verifyLoopBoundaries, repoRoot, {})
        expect(all.val).toBe(0)
        expect(all.dat.valid).toBe(true)
        expect(all.dat.stemsChecked).toHaveLength(3)

        const target = await run(musicBuzz.verifyLoopBoundaries, repoRoot, {
            stemId: 'music://the_parallax_dinner/amb_diner_rain_hum',
        })
        expect(target.val).toBe(0)
        expect(target.dat.stemsChecked).toEqual(['amb_diner_rain_hum'])
    })
})

describe('Parallax Dinner Music Vault :: stem resolution', () => {
    it('resolveMusicStem resolves bare IDs and namespaced music:// URIs', async () => {
        for (const stemId of Object.keys(CANONICAL_STEMS)) {
            for (const raw of [
                stemId,
                `music://the_parallax_dinner/${stemId}`,
                `MUSIC://${stemId.toUpperCase()}`,
            ]) {
                const res = await run(musicBuzz.resolveMusicStem, repoRoot, {
                    stemId: raw,
                })
                expect(res.val).toBe(0)
                expect(res.dat.valid).toBe(true)
                expect(res.dat.statusCode).toBe('MUSIC_STEM_COMPLIANT')
                expect(res.dat.stemId).toBe(stemId)
                expect(res.dat.stem.wav_path).toBe(CANONICAL_STEMS[stemId].wav)
            }
        }
    })

    it('fails closed with MUSIC_STEM_UNREGISTERED_BREACH on unknown stems', async () => {
        const ste = makeSte()
        let slv: any = null
        const model = new MusicModel()
        model.musicRoot = repoRoot
        await expect(
            musicBuzz.resolveMusicStem(
                model,
                {
                    idx: 't',
                    dat: { stemId: 'scr_unregistered_cue' },
                    slv: (r: any) => (slv = r),
                },
                ste,
            ),
        ).rejects.toThrow('MUSIC_STEM_UNREGISTERED_BREACH')
        expect(slv.musicBit.val).toBe(-1)
        expect(slv.musicBit.dat.statusCode).toBe(
            'MUSIC_STEM_UNREGISTERED_BREACH',
        )
        expect(
            ste.lines.some((line) =>
                line.includes('MUSIC_STEM_UNREGISTERED_BREACH'),
            ),
        ).toBe(true)
    })
})

describe('Parallax Dinner Music Vault :: spectral linter traps', () => {
    it('traps LOOP_BOUNDARY_CLICK_BREACH on a high final-sample DC offset', () => {
        const wavPath = path.join(
            repoRoot,
            CANONICAL_STEMS.amb_diner_rain_hum.wav,
        )
        const buffer = fs.readFileSync(wavPath)
        const dataOffset = buffer.indexOf(Buffer.from('data')) + 8
        const dataSize = buffer.readUInt32LE(
            buffer.indexOf(Buffer.from('data')) + 4,
        )
        buffer[dataOffset + dataSize - 3] = 0xff
        buffer[dataOffset + dataSize - 2] = 0xff
        buffer[dataOffset + dataSize - 1] = 0x7f

        const result = verifySeamlessLoopZeroCrossing(
            buffer,
            0.02,
            'amb_diner_rain_hum',
        )
        expect(result.valid).toBe(false)
        expect(result.statusCode).toBe('LOOP_BOUNDARY_CLICK_BREACH')
        expect(result.lastSampleNormalized).toBeGreaterThan(0.9)
    })

    it('traps VOCAL_BAND_MASKING_BREACH when ceiling or ducking headroom is insufficient', () => {
        const stem: MusicStemDefinition = {
            ...loadManifest().stems.scr_wiregrass_tension_low,
            vocal_band_ceiling_dbfs: -10,
        }
        const loud = auditVocalBandEnergy(stem)
        expect(loud.valid).toBe(false)
        expect(loud.statusCode).toBe('VOCAL_BAND_MASKING_BREACH')

        const shallowDuck = auditVocalBandEnergy({
            ...stem,
            vocal_band_ceiling_dbfs: -18,
            recommended_ducking_db: -3,
        })
        expect(shallowDuck.valid).toBe(false)
        expect(shallowDuck.statusCode).toBe('VOCAL_BAND_MASKING_BREACH')
    })
})

describe('Parallax Dinner Music Vault :: registration and reducer', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_music_register')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(path.join(testRoot, 'music', 'score'))
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    it('registerMusicStem validates a WAV, computes SHA/delta, and updates the manifest', async () => {
        const ste = makeSte()
        const src = path.join(
            repoRoot,
            CANONICAL_STEMS.scr_wiregrass_tension_low.wav,
        )
        const dest = path.join(testRoot, 'music', 'score', 'custom_tension.wav')
        await fs.copy(src, dest)

        const res = await run(
            musicBuzz.registerMusicStem,
            testRoot,
            {
                stemId: 'custom_tension',
                wavPath: 'music/score/custom_tension.wav',
                description: 'Custom tension stem.',
            },
            ste,
        )
        expect(res.val).toBe(1)
        expect(res.dat.stem.stem_id).toBe('custom_tension')
        expect(res.dat.stem.sha256).toBe(
            createHash('sha256').update(fs.readFileSync(dest)).digest('hex'),
        )
        expect(res.dat.stem.zero_crossing_delta).toBe(0)
        expect(
            ste.lines.some((line) => line.startsWith('>> [MUSIC:REGISTER]')),
        ).toBe(true)

        const manifest = await fs.readJson(
            path.join(testRoot, 'music', 'manifest.json'),
        )
        expect(manifest.stems.custom_tension.wav_path).toBe(
            'music/score/custom_tension.wav',
        )
    })

    it('reducer routes music actions through clone(model, true)', async () => {
        const model = new MusicModel()
        model.musicRoot = repoRoot
        const next = await reducer(
            model,
            new Act.ResolveMusicStem({
                idx: 't',
                dat: { stemId: 'amb_diner_rain_hum' },
            }),
        )
        expect(next).not.toBe(model)
        expect(next.idx).toBe('03.music')
        expect(next.lastResolutionStatus).toBe('MUSIC_STEM_COMPLIANT')

        const updated = await reducer(
            new MusicModel(),
            new Act.UpdateMusic({
                idx: 't',
                dat: {
                    stemsRegistered: 3,
                    lastRegisteredStem: 'amb_diner_rain_hum',
                },
            }),
        )
        expect(updated.stemsRegistered).toBe(3)
        expect(updated.lastRegisteredStem).toBe('amb_diner_rain_hum')
    })

    it('all cns00 telemetry is pure 7-bit ASCII', async () => {
        const ste = makeSte()
        await musicBuzz.initMusic(new MusicModel(), { idx: 'init' }, ste)
        await run(musicBuzz.validateMusicManifest, repoRoot, {}, ste)
        await run(musicBuzz.verifyLoopBoundaries, repoRoot, {}, ste)
        await run(
            musicBuzz.resolveMusicStem,
            repoRoot,
            { stemId: 'scr_parallax_revelation_pad' },
            ste,
        )
        expect(ste.lines.length).toBeGreaterThan(3)
        for (const line of ste.lines) {
            expect(line).toMatch(/^[\x20-\x7E]*$/)
        }
    })
})
