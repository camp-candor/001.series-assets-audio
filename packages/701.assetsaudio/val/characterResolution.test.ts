import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import {
    normalizeCharacterSlug,
    matchExistingCharacter,
    scaffoldNewCharacterProfile,
} from '../01.voice.unit/buz/characterMatch.buzz.js'
import { resolveMonotonicVersion } from '../01.voice.unit/buz/versionResolver.buzz.js'
import { VoiceModel } from '../01.voice.unit/voice.model.js'

describe('Character Resolution Monotonic Versioning Feature Tests', () => {
    const testRoot = path.resolve(
        process.cwd(),
        '.tmp_test_character_resolution',
    )

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(testRoot)
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    it('normalizes character slug to lowercase alphanumeric with underscores', () => {
        expect(normalizeCharacterSlug('Bog')).toBe('bog')
        expect(normalizeCharacterSlug('The Pilot')).toBe('the_pilot')
        expect(normalizeCharacterSlug('Billie-Fae')).toBe('billie_fae')
        expect(normalizeCharacterSlug('  Silas  Vane! ')).toBe('silas_vane')
    })

    it('matches existing characters from voice manifest and returns profile summaries', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        await fs.ensureDir(voicesDir)

        const mockManifest = {
            voices: {
                char_bog: {
                    display_name: 'Bog',
                    base_state: 'neutral',
                    condition_variants: {
                        neutral: { active_version: 'v2' },
                        panicked: { active_version: 'v1' },
                    },
                },
                char_silas: {
                    display_name: 'Silas Vane',
                    base_state: 'neutral',
                    active_version: 'v1',
                },
            },
        }

        await fs.writeJson(
            path.join(voicesDir, 'voice_manifest.json'),
            mockManifest,
        )

        let slvResult: any = null
        const bit: any = {
            idx: 'test-match',
            src: testRoot,
            slv: (res: any) => {
                slvResult = res
            },
        }

        await matchExistingCharacter(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.val).toBe(2)

        const profiles = slvResult.voiBit.dat
        expect(profiles[0].characterSlug).toBe('char_bog')
        expect(profiles[0].latestVersion).toBe(2)
        expect(profiles[0].registeredConditions).toContain('panicked')
        expect(profiles[1].characterSlug).toBe('char_silas')
        expect(profiles[1].latestVersion).toBe(1)
    })

    it('scaffolds new candidate character profile when slug is unique', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        await fs.ensureDir(voicesDir)
        await fs.writeJson(path.join(voicesDir, 'voice_manifest.json'), {
            voices: {},
        })

        let slvResult: any = null
        const bit: any = {
            idx: 'test-scaffold',
            dat: {
                characterSlug: 'Elias',
                displayName: 'Elias Thorne',
            },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await scaffoldNewCharacterProfile(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.dat.characterSlug).toBe('elias')
        expect(slvResult.voiBit.dat.displayName).toBe('Elias Thorne')
        expect(slvResult.voiBit.dat.latestVersion).toBe(0)
        expect(slvResult.voiBit.dat.isExisting).toBe(false)
    })

    it('rejects duplicate character registration throwing breach error', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        await fs.ensureDir(voicesDir)
        await fs.writeJson(path.join(voicesDir, 'voice_manifest.json'), {
            voices: {
                char_bog: { display_name: 'Bog' },
            },
        })

        const bit: any = {
            idx: 'test-scaffold-dup',
            dat: { characterSlug: 'char_bog' },
        }

        await expect(scaffoldNewCharacterProfile(model, bit)).rejects.toThrow(
            'CHARACTER_ALREADY_REGISTERED_BREACH',
        )
    })

    it('resolves version 1 for newly registered character with no prior version files', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        let slvResult: any = null
        const bit: any = {
            idx: 'test-res-v1',
            dat: { characterSlug: 'char_wart' },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await resolveMonotonicVersion(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.val).toBe(1)
        expect(slvResult.voiBit.dat.currentVersion).toBe(0)
        expect(slvResult.voiBit.dat.nextVersion).toBe(1)
        expect(slvResult.voiBit.dat.targetFileName).toBe('char_wart_v1.wav')
        expect(slvResult.voiBit.dat.isNewCharacter).toBe(true)
    })

    it('monotonically increments version based on highest version file found on disk', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const versionsDir = path.join(testRoot, 'voices', 'versions')
        await fs.ensureDir(versionsDir)

        // Seed versions 1 and 2
        await fs.writeFile(
            path.join(versionsDir, 'char_bog_v1.wav'),
            'audio-data',
        )
        await fs.writeFile(
            path.join(versionsDir, 'char_bog_v2.wav'),
            'audio-data',
        )

        let slvResult: any = null
        const bit: any = {
            idx: 'test-res-v3',
            dat: { characterSlug: 'char_bog' },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await resolveMonotonicVersion(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.val).toBe(3)
        expect(slvResult.voiBit.dat.currentVersion).toBe(2)
        expect(slvResult.voiBit.dat.nextVersion).toBe(3)
        expect(slvResult.voiBit.dat.targetFileName).toBe('char_bog_v3.wav')
    })

    it('correctly incorporates condition tag into target file name', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const versionsDir = path.join(testRoot, 'voices', 'versions')
        await fs.ensureDir(versionsDir)
        await fs.writeFile(
            path.join(versionsDir, 'char_bog_panicked_v1.wav'),
            'audio-data',
        )

        let slvResult: any = null
        const bit: any = {
            idx: 'test-res-cond',
            dat: {
                characterSlug: 'char_bog',
                conditionTag: 'panicked',
            },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await resolveMonotonicVersion(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.val).toBe(2)
        expect(slvResult.voiBit.dat.targetFileName).toBe(
            'char_bog_panicked_v2.wav',
        )
    })

    it('fails closed when requested version regresses or matches existing version', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const versionsDir = path.join(testRoot, 'voices', 'versions')
        await fs.ensureDir(versionsDir)
        await fs.writeFile(
            path.join(versionsDir, 'char_bog_v2.wav'),
            'audio-data',
        )

        const bit: any = {
            idx: 'test-regression',
            dat: {
                characterSlug: 'char_bog',
                requestedVersion: 2, // Must be > 2
            },
        }

        await expect(resolveMonotonicVersion(model, bit)).rejects.toThrow(
            'MONOTONIC_VERSION_REGRESSION_BREACH',
        )
    })

    it('fails closed when character slug is empty during scaffolding', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        let slvResult: any = null
        const bit: any = {
            idx: 'test-empty-slug',
            dat: { characterSlug: '   ' },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await expect(scaffoldNewCharacterProfile(model, bit)).rejects.toThrow(
            'CHARACTER_SLUG_EMPTY_BREACH',
        )
        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.val).toBe(-1)
    })

    it('verifies end-to-end character matcher traversal and monotonic telemetry', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        const versionsDir = path.join(voicesDir, 'versions')
        await fs.ensureDir(versionsDir)

        const manifest = {
            voices: {
                char_billie_fae: {
                    display_name: 'Billie-Fae',
                    base_state: 'neutral',
                    active_version: 'v1',
                },
                char_bog: {
                    display_name: 'Bog',
                    base_state: 'neutral',
                    active_version: 'v2',
                },
                char_mum_grissel: {
                    display_name: 'Mum Grissel',
                    base_state: 'neutral',
                    active_version: 'v2',
                },
                char_silas: {
                    display_name: 'Silas',
                    base_state: 'neutral',
                    active_version: 'v1',
                },
            },
        }
        await fs.writeJson(
            path.join(voicesDir, 'voice_manifest.json'),
            manifest,
        )

        await fs.writeFile(path.join(versionsDir, 'char_bog_v1.wav'), 'data')
        await fs.writeFile(path.join(versionsDir, 'char_bog_v2.wav'), 'data')

        const telemetry: string[] = []
        const ste = {
            hunt: async (type: string, payload: any) => {
                if (payload?.src) telemetry.push(payload.src)
            },
        }

        let matchResult: any = null
        await matchExistingCharacter(
            model,
            {
                idx: 'match-existing-character',
                src: testRoot,
                slv: (res: any) => {
                    matchResult = res
                },
            } as any,
            ste,
        )

        expect(matchResult).toBeDefined()
        expect(matchResult.voiBit.val).toBe(4)

        const profiles = matchResult.voiBit.dat
        const choiceList = profiles.map(
            (p: any, idx: number) =>
                `[${idx + 1}] ${p.characterSlug} (${p.latestVersionTag})`,
        )
        choiceList.push('[+] REGISTER NEW CHARACTER')

        expect(choiceList).toEqual([
            '[1] char_billie_fae (v1)',
            '[2] char_bog (v2)',
            '[3] char_mum_grissel (v2)',
            '[4] char_silas (v1)',
            '[+] REGISTER NEW CHARACTER',
        ])
        expect(telemetry).toContain(
            '>> [CHARACTER] Manifest query returned 4 registered character identities.',
        )

        let resolveResult: any = null
        await resolveMonotonicVersion(
            model,
            {
                idx: 'resolve-monotonic-version',
                dat: { characterSlug: 'char_bog' },
                slv: (res: any) => {
                    resolveResult = res
                },
            } as any,
            ste,
        )

        expect(resolveResult).toBeDefined()
        expect(resolveResult.voiBit.val).toBe(3)
        expect(resolveResult.voiBit.dat.currentVersion).toBe(2)
        expect(resolveResult.voiBit.dat.nextVersion).toBe(3)
        expect(resolveResult.voiBit.dat.targetFileName).toBe('char_bog_v3.wav')
        expect(telemetry).toContain(
            '>> [VERSION:RESOLVE] Character [char_bog] version calculated: v2 -> v3 (char_bog_v3.wav).',
        )
    })
})
