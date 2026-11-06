import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import {
    validateDspModifiers,
    configureVoiceRecipe,
    commitRecipeToManifest,
    DEFAULT_DSP_MODIFIERS,
} from '../01.voice.unit/buz/recipeConfig.buzz.js'
import { VoiceModel } from '../01.voice.unit/voice.model.js'

describe('Generative Engine Recipe Configuration Feature Tests', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_recipe_config')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(testRoot)
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    it('validates default DSP parameters within exact bounds', () => {
        const res = validateDspModifiers()
        expect(res).toEqual(DEFAULT_DSP_MODIFIERS)
        expect(res.pitchShiftSemitones).toBe(0.0)
        expect(res.formantWarpingFactor).toBe(1.0)
        expect(res.speedScalar).toBe(1.0)
        expect(res.breathinessMultiplier).toBe(1.0)
        expect(res.vocalFryDensity).toBe(0.0)
    })

    it('rejects pitch shift outside [-12.0, 12.0] bounds with breach error', () => {
        expect(() =>
            validateDspModifiers({ pitchShiftSemitones: 12.5 }),
        ).toThrow('DSP_BOUNDS_BREACH')
        expect(() =>
            validateDspModifiers({ pitchShiftSemitones: -13.0 }),
        ).toThrow('DSP_BOUNDS_BREACH')
    })

    it('rejects formant warping factor outside [0.5, 2.0] bounds with breach error', () => {
        expect(() =>
            validateDspModifiers({ formantWarpingFactor: 0.4 }),
        ).toThrow('DSP_BOUNDS_BREACH')
        expect(() =>
            validateDspModifiers({ formantWarpingFactor: 2.1 }),
        ).toThrow('DSP_BOUNDS_BREACH')
    })

    it('rejects speed scalar outside [0.1, 3.0] bounds with breach error', () => {
        expect(() => validateDspModifiers({ speedScalar: 0.05 })).toThrow(
            'DSP_BOUNDS_BREACH',
        )
        expect(() => validateDspModifiers({ speedScalar: 3.5 })).toThrow(
            'DSP_BOUNDS_BREACH',
        )
    })

    it('rejects breathiness multiplier outside [1.0, 3.5] bounds with breach error', () => {
        expect(() =>
            validateDspModifiers({ breathinessMultiplier: 0.9 }),
        ).toThrow('DSP_BOUNDS_BREACH')
        expect(() =>
            validateDspModifiers({ breathinessMultiplier: 3.6 }),
        ).toThrow('DSP_BOUNDS_BREACH')
    })

    it('rejects vocal fry density outside [0.0, 1.0] bounds with breach error', () => {
        expect(() => validateDspModifiers({ vocalFryDensity: -0.1 })).toThrow(
            'DSP_BOUNDS_BREACH',
        )
        expect(() => validateDspModifiers({ vocalFryDensity: 1.1 })).toThrow(
            'DSP_BOUNDS_BREACH',
        )
    })

    it('rejects unsupported neural vocoder target with breach error', async () => {
        const model = new VoiceModel()
        const bit: any = {
            idx: 'test-recipe-unsupported',
            dat: {
                characterSlug: 'char_bog',
                ttsEngine: 'UnsupportedVocoderV1',
            },
        }

        await expect(configureVoiceRecipe(model, bit)).rejects.toThrow(
            'UNSUPPORTED_VOCODER_ENGINE_BREACH',
        )
    })

    it('configures valid voice recipe with calibrated DSP parameters', async () => {
        const model = new VoiceModel()
        let slvResult: any = null

        const bit: any = {
            idx: 'test-recipe-valid',
            dat: {
                characterSlug: 'char_silas',
                ttsEngine: 'Chatterbox-Base-FP16',
                conditioningStrategy: 'ZERO_SHOT_CLONE',
                baseDspModifiers: {
                    pitchShiftSemitones: -3.5,
                    formantWarpingFactor: 1.15,
                    speedScalar: 0.95,
                    breathinessMultiplier: 1.25,
                    vocalFryDensity: 0.4,
                },
                bannedCadences: ['RAPID_STACCATO'],
            },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await configureVoiceRecipe(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.val).toBe(0)
        const recipe = slvResult.voiBit.dat
        expect(recipe.characterSlug).toBe('char_silas')
        expect(recipe.ttsEngine).toBe('Chatterbox-Base-FP16')
        expect(recipe.baseDspModifiers.pitchShiftSemitones).toBe(-3.5)
        expect(recipe.bannedCadences).toContain('RAPID_STACCATO')
    })

    it('commits recipe to voice_manifest.json atomically with sorted keys', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        await fs.ensureDir(voicesDir)

        const recipe = {
            characterSlug: 'char_bog',
            ttsEngine: 'CosyVoice-300M',
            conditioningStrategy: 'ZERO_SHOT_CLONE',
            referenceTakePath: 'voices/versions/char_bog_v1.wav',
            embeddingPath: 'voices/embeddings/char_bog_v1.pt',
            baseDspModifiers: {
                pitchShiftSemitones: 2.0,
                formantWarpingFactor: 0.9,
                speedScalar: 1.1,
                breathinessMultiplier: 1.0,
                vocalFryDensity: 0.1,
            },
            bannedCadences: ['BREATHLESS_WHISPER'],
        }

        let slvResult: any = null
        const bit: any = {
            idx: 'test-commit',
            dat: { recipe },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await commitRecipeToManifest(model, bit)

        expect(slvResult).toBeDefined()
        const manifestPath = path.join(voicesDir, 'voice_manifest.json')
        expect(await fs.pathExists(manifestPath)).toBe(true)

        const written = await fs.readJson(manifestPath)
        expect(written.voices.char_bog.tts_engine).toBe('CosyVoice-300M')
        expect(
            written.voices.char_bog.base_dsp_modifiers.pitch_shift_semitones,
        ).toBe(2.0)
        expect(written.voices.char_bog.banned_cadences).toContain(
            'BREATHLESS_WHISPER',
        )
    })
})
