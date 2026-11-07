import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs-extra'
import * as path from 'path'
import { compileAudioLockfile } from '../25.sync.unit/buz/fleetSync.buzz.js'
import { verifyCrossRepoLockfileParity } from '../25.sync.unit/buz/lockfileAudit.buzz.js'
import { calculateVersionBumpBlastRadius } from '../25.sync.unit/buz/blastRadius.buzz.js'
import { verifyLoreCharacterAndCueParity } from '../00.assetsaudio.unit/buz/loreParity.buzz.js'
import { verifyScreenplayAstAudioPointers } from '../00.assetsaudio.unit/buz/astPointerCheck.buzz.js'
import { auditDialogueLexiconCoverage } from '../00.assetsaudio.unit/buz/lexiconAudit.buzz.js'

const TEST_DIR = path.join(__dirname, 'temp_sync_test')

describe('Cross-Repository Sync & Interlock Validator', () => {
    beforeEach(async () => {
        await fs.ensureDir(TEST_DIR)
        await fs.ensureDir(path.join(TEST_DIR, 'voices'))
        await fs.ensureDir(path.join(TEST_DIR, 'foley'))
        await fs.ensureDir(path.join(TEST_DIR, 'music'))

        await fs.writeJson(path.join(TEST_DIR, 'voices/voice_manifest.json'), {
            voices: {
                char_johnny_walkman: {
                    path: '/v/j.wav',
                    version: '1.0.0',
                    sha256: 'abc',
                },
                char_orbie_mayhaw: {
                    path: '/v/o.wav',
                    version: '1.0.0',
                    sha256: 'def',
                },
            },
        })
        await fs.writeJson(path.join(TEST_DIR, 'voices/lexicon.json'), {
            entries: {
                Mayhaw: { ipa: 'm eɪ h ɔ', version: '1.0.0', sha256: 'ghi' },
                Okefenokee: {
                    ipa: 'oʊ k i f ə n oʊ k i',
                    version: '1.0.0',
                    sha256: 'jkl',
                },
                astigmatism: {
                    ipa: 'ə s t ɪ ɡ m ə t ɪ z ə m',
                    version: '1.0.0',
                    sha256: 'mno',
                },
                Phoropter: {
                    ipa: 'f ɔ r ɒ p t ər',
                    version: '1.0.0',
                    sha256: 'pqr',
                },
            },
        })
        await fs.writeJson(path.join(TEST_DIR, 'foley/registry.json'), {
            cues: {
                cue_dinner_plate_clink: {
                    path: '/f/1.wav',
                    version: '1.0.0',
                    sha256: '111',
                },
                cue_dinner_fork_scrape: {
                    path: '/f/2.wav',
                    version: '1.0.0',
                    sha256: '222',
                },
                cue_dinner_glass_set: {
                    path: '/f/3.wav',
                    version: '1.0.0',
                    sha256: '333',
                },
                cue_dinner_chair_creak: {
                    path: '/f/4.wav',
                    version: '1.0.0',
                    sha256: '444',
                },
                cue_dinner_napkin_rustle: {
                    path: '/f/5.wav',
                    version: '1.0.0',
                    sha256: '555',
                },
                cue_dinner_throat_clear: {
                    path: '/f/6.wav',
                    version: '1.0.0',
                    sha256: '666',
                },
                cue_dinner_water_pour: {
                    path: '/f/7.wav',
                    version: '1.0.0',
                    sha256: '777',
                },
                cue_dinner_wine_pour: {
                    path: '/f/8.wav',
                    version: '1.0.0',
                    sha256: '888',
                },
                cue_dinner_table_thump: {
                    path: '/f/9.wav',
                    version: '1.0.0',
                    sha256: '999',
                },
            },
        })
        await fs.writeJson(path.join(TEST_DIR, 'music/manifest.json'), {
            stems: {
                amb_diner_rain_hum: {
                    path: '/m/1.wav',
                    version: '1.0.0',
                    sha256: 'aaa',
                },
            },
        })
    })

    afterEach(async () => {
        await fs.remove(TEST_DIR)
    })

    it('should compile deterministic lockfile', () => {
        const lockfile1 = compileAudioLockfile(TEST_DIR)
        const lockfile2 = compileAudioLockfile(TEST_DIR)
        expect(lockfile1.merkle_root_sha256).toBe(lockfile2.merkle_root_sha256)
        expect(Object.keys(lockfile1.assets).length).toBe(16)
    })

    it('should verify lockfile parity correctly', () => {
        const lockfile = compileAudioLockfile(TEST_DIR)
        expect(() =>
            verifyCrossRepoLockfileParity(lockfile, lockfile),
        ).not.toThrow()

        const drifted = JSON.parse(JSON.stringify(lockfile))
        drifted.merkle_root_sha256 = 'drifted'
        drifted.assets['char_johnny_walkman'].sha256 = 'drifted_sha'

        expect(() => verifyCrossRepoLockfileParity(lockfile, drifted)).toThrow(
            /CROSS_REPO_LOCKFILE_DRIFT_BREACH: char_johnny_walkman/,
        )
    })

    it('should calculate blast radius', () => {
        const ast = [
            {
                scene_id: 's1',
                dialogue_lines: [
                    { line_id: 'l1', speaker_id: 'char_johnny_walkman' },
                    { line_id: 'l2', speaker_id: 'char_orbie_mayhaw' },
                ],
            },
            {
                scene_id: 's2',
                dialogue_lines: [{ line_id: 'l3', speaker_id: 'char_other' }],
            },
        ]

        const radius = calculateVersionBumpBlastRadius(
            ['char_johnny_walkman'],
            ast,
        )
        expect(radius.invalidatedSceneIds).toEqual(['s1'])
        expect(radius.invalidatedLineIds).toEqual(['l1'])
    })

    it('should verify lore parity', () => {
        expect(() => verifyLoreCharacterAndCueParity(TEST_DIR)).not.toThrow()

        // Break parity - missing character
        fs.writeJsonSync(path.join(TEST_DIR, 'voices/voice_manifest.json'), {
            voices: {},
        })
        expect(() => verifyLoreCharacterAndCueParity(TEST_DIR)).toThrow(
            /LORE_ASSET_PARITY_BREACH/,
        )

        // Break parity - missing cue
        fs.writeJsonSync(path.join(TEST_DIR, 'voices/voice_manifest.json'), {
            voices: {
                char_johnny_walkman: {
                    path: '/v/j.wav',
                    version: '1.0.0',
                    sha256: 'abc',
                },
                char_orbie_mayhaw: {
                    path: '/v/o.wav',
                    version: '1.0.0',
                    sha256: 'def',
                },
            },
        })
        fs.writeJsonSync(path.join(TEST_DIR, 'foley/registry.json'), {
            cues: {},
        })
        expect(() => verifyLoreCharacterAndCueParity(TEST_DIR)).toThrow(
            /LORE_ASSET_PARITY_BREACH/,
        )
    })

    it('should verify AST pointers', () => {
        const ast = {
            dialogue_lines: [
                {
                    speaker_id: 'char_johnny_walkman',
                    foley_cues: ['cue_dinner_plate_clink'],
                    ambient_stems: ['amb_diner_rain_hum'],
                },
            ],
        }
        expect(() =>
            verifyScreenplayAstAudioPointers(TEST_DIR, ast),
        ).not.toThrow()

        const badAst = {
            dialogue_lines: [
                {
                    speaker_id: 'char_phantom_nonexistent',
                    foley_cues: ['missing_cue'],
                    ambient_stems: ['missing_stem'],
                },
            ],
        }
        expect(() =>
            verifyScreenplayAstAudioPointers(TEST_DIR, badAst),
        ).toThrow(
            /AST_DANGLING_AUDIO_POINTER_BREACH: char_phantom_nonexistent, missing_cue, missing_stem/,
        )
    })

    it('should audit lexicon coverage', () => {
        expect(() =>
            auditDialogueLexiconCoverage(TEST_DIR, [
                'I live in Okefenokee',
                'I want some mayhaw jelly',
            ]),
        ).not.toThrow()

        const badLines = [
            'I live in Okefenokee with astigmatism but no Phoropter or Mayhaw',
            'and also missingterm',
        ]

        fs.writeJsonSync(path.join(TEST_DIR, 'voices/lexicon.json'), {
            entries: {},
        }) // remove all entries
        expect(() => auditDialogueLexiconCoverage(TEST_DIR, badLines)).toThrow(
            /LEXICON_COVERAGE_MISSING_BREACH: .*/,
        )
    })

    it('should verify live repository vault parity and lockfile compilation with cns00 telemetry', () => {
        const hunted: any[] = []
        ;(global as any).LIBRARY = {
            hunt: async (action: string, bit: any) => {
                hunted.push({ action, bit })
                return { val: 0 }
            },
        }

        const lockfile = compileAudioLockfile(process.cwd())
        expect(lockfile.merkle_root_sha256).toBeDefined()
        expect(lockfile.merkle_root_sha256.length).toBe(64)

        const loreResult = verifyLoreCharacterAndCueParity(process.cwd())
        expect(loreResult).toBe(true)

        const lockfileTelemetry = hunted.find(
            (h) =>
                h.bit?.src && h.bit.src.includes('>> [SYNC:LOCKFILE:SEALED]'),
        )
        const loreTelemetry = hunted.find(
            (h) => h.bit?.src && h.bit.src.includes('>> [LORE:PARITY:OK]'),
        )

        expect(lockfileTelemetry).toBeDefined()
        expect(loreTelemetry).toBeDefined()

        delete (global as any).LIBRARY
    })
})
