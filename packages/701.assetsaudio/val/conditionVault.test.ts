import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import {
    normalizeConditionTag,
    registerConditionVariant,
    resolveConditionTakes,
    retargetConditionSymlink,
    auditConditionVault,
} from '../01.voice.unit/buz/conditionVault.buzz.js'
import { VoiceModel } from '../01.voice.unit/voice.model.js'

describe('Multi-Reference Condition Vault Management Feature Tests', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_condition_vault')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(testRoot)
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    const provisionCondition = async (
        characterSlug: string,
        conditionTag: string,
        versionTag: string,
    ) => {
        const voicesDir = path.join(testRoot, 'voices')
        const take = path.join(
            voicesDir,
            'versions',
            `${characterSlug}_${conditionTag}_${versionTag}.wav`,
        )
        await fs.ensureDir(path.dirname(take))
        await fs.ensureDir(path.join(voicesDir, 'active'))
        await fs.ensureDir(path.join(voicesDir, 'embeddings'))
        await fs.writeFile(take, 'audio')
        await fs.chmod(take, 0o444)
        await fs.symlink(
            path.join(
                '..',
                'versions',
                `${characterSlug}_${conditionTag}_${versionTag}.wav`,
            ),
            path.join(
                voicesDir,
                'active',
                `${characterSlug}--${conditionTag}.wav`,
            ),
        )
        await fs.writeFile(
            path.join(
                voicesDir,
                'embeddings',
                `${characterSlug}_${conditionTag}_${versionTag}.pt`,
            ),
            'tensor',
        )
    }

    it('normalizes condition tags then rejects invalid or reserved tags', async () => {
        expect(normalizeConditionTag('Panicked')).toBe('panicked')
        expect(normalizeConditionTag('Combat-Fatigue ')).toBe('combat_fatigue')
        expect(normalizeConditionTag('whis pered!')).toBe('whis_pered')

        const model = new VoiceModel()
        model.voicesRoot = testRoot

        for (const conditionTag of ['neutral', 'NEUTRAL', '', '!!!']) {
            let slvResult: any = null
            const bit: any = {
                idx: 'test-invalid-tag',
                dat: { characterSlug: 'char_bog', conditionTag },
                slv: (res: any) => {
                    slvResult = res
                },
            }
            await expect(registerConditionVariant(model, bit)).rejects.toThrow(
                'CONDITION_TAG_INVALID_BREACH',
            )
            expect(slvResult.voiBit.val).toBe(-1)
        }

        expect(
            await fs.pathExists(
                path.join(testRoot, 'voices', 'voice_manifest.json'),
            ),
        ).toBe(false)
    })

    it('registers condition variant into voice_manifest.json with RFC 8785 key sorting', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        await fs.ensureDir(voicesDir)
        await fs.writeJson(path.join(voicesDir, 'voice_manifest.json'), {
            voices: {
                char_zed: { display_name: 'Zed', active_version: 'v1' },
            },
        })

        let slvResult: any = null
        const bit: any = {
            idx: 'test-register',
            dat: {
                characterSlug: 'char_silas',
                conditionTag: 'Exhausted',
                somaticTrigger: 'pulmonary_fatigue',
                description: 'Exhausted breathy delivery',
                dspOverrides: { tempo: 0.9, pitch: -1 },
            },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await registerConditionVariant(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.val).toBe(0)
        expect(slvResult.voiBit.src).toBe('exhausted')

        const manifestPath = path.join(voicesDir, 'voice_manifest.json')
        const content = await fs.readJson(manifestPath)
        const variant = content.voices.char_silas.condition_variants.exhausted
        expect(variant.somatic_trigger).toBe('pulmonary_fatigue')
        expect(variant.active_version).toBe('v1')

        expect(Object.keys(content.voices)).toEqual(['char_silas', 'char_zed'])
        expect(Object.keys(content.voices.char_silas)).toEqual(
            [...Object.keys(content.voices.char_silas)].sort(),
        )
        expect(Object.keys(variant)).toEqual([...Object.keys(variant)].sort())
        expect(Object.keys(variant.dsp_overrides)).toEqual(['pitch', 'tempo'])

        const leftovers = (await fs.readdir(voicesDir)).filter((f) =>
            f.startsWith('.tmp_manifest_'),
        )
        expect(leftovers).toEqual([])
    })

    it('resolves condition takes from disk then detects latest version', async () => {
        const versionsDir = path.join(testRoot, 'voices', 'versions')
        await fs.ensureDir(versionsDir)

        await fs.writeFile(
            path.join(versionsDir, 'char_bog_panicked_v1.wav'),
            'd',
        )
        await fs.writeFile(
            path.join(versionsDir, 'char_bog_panicked_v2.wav'),
            'd',
        )
        await fs.writeFile(
            path.join(versionsDir, 'char_bog_panicked_v10.wav'),
            'd',
        )
        await fs.writeFile(path.join(versionsDir, 'char_bog_v1.wav'), 'd')
        await fs.writeFile(
            path.join(versionsDir, 'char_bog_whispered_v4.wav'),
            'd',
        )

        const { versions, latestVersion } = await resolveConditionTakes(
            versionsDir,
            'char_bog',
            'panicked',
        )

        expect(versions).toEqual([1, 2, 10])
        expect(latestVersion).toBe(10)

        const empty = await resolveConditionTakes(
            path.join(testRoot, 'absent'),
            'char_bog',
            'panicked',
        )
        expect(empty).toEqual({ versions: [], latestVersion: 0 })
    })

    it('atomically swaps double-hyphen condition active symlink', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        const activeDir = path.join(voicesDir, 'active')
        await fs.ensureDir(activeDir)
        await fs.writeJson(path.join(voicesDir, 'voice_manifest.json'), {
            voices: {
                char_bog: {
                    condition_variants: { panicked: { active_version: 'v1' } },
                },
            },
        })

        const symlinkPath = path.join(activeDir, 'char_bog--panicked.wav')

        for (const versionNumber of [1, 2]) {
            let slvResult: any = null
            const bit: any = {
                idx: 'test-symlink',
                dat: {
                    characterSlug: 'char_bog',
                    conditionTag: 'panicked',
                    versionNumber,
                },
                slv: (res: any) => {
                    slvResult = res
                },
            }
            await retargetConditionSymlink(model, bit)
            expect(slvResult.voiBit.val).toBe(versionNumber)
            expect(await fs.readlink(symlinkPath)).toBe(
                path.join(
                    '..',
                    'versions',
                    `char_bog_panicked_v${versionNumber}.wav`,
                ),
            )
        }

        const entries = await fs.readdir(activeDir)
        expect(entries).toEqual(['char_bog--panicked.wav'])

        const manifest = await fs.readJson(
            path.join(voicesDir, 'voice_manifest.json'),
        )
        expect(
            manifest.voices.char_bog.condition_variants.panicked.active_version,
        ).toBe('v2')

        await expect(
            retargetConditionSymlink(model, {
                idx: 'test-symlink-neutral',
                dat: {
                    characterSlug: 'char_bog',
                    conditionTag: 'neutral',
                    versionNumber: 1,
                },
            } as any),
        ).rejects.toThrow('RETARGET_PAYLOAD_INVALID')
    })

    it('audits condition vault then detects missing files with permission regressions', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        await fs.ensureDir(path.join(voicesDir, 'versions'))
        await fs.ensureDir(path.join(voicesDir, 'active'))
        await fs.ensureDir(path.join(voicesDir, 'embeddings'))

        await fs.writeJson(path.join(voicesDir, 'voice_manifest.json'), {
            voices: {
                char_silas: {
                    display_name: 'Silas Vane',
                    condition_variants: {
                        panicked: { active_version: 'v1' },
                        exhausted: { active_version: 'v1' },
                        whispered: { active_version: 'v2' },
                    },
                },
            },
        })

        await provisionCondition('char_silas', 'panicked', 'v1')

        const writableTake = path.join(
            voicesDir,
            'versions',
            'char_silas_whispered_v2.wav',
        )
        await fs.writeFile(writableTake, 'audio')
        await fs.chmod(writableTake, 0o644)
        await fs.symlink(
            path.join('..', 'versions', 'char_silas_whispered_v1.wav'),
            path.join(voicesDir, 'active', 'char_silas--whispered.wav'),
        )
        await fs.writeFile(
            path.join(voicesDir, 'embeddings', 'char_silas_whispered_v2.pt'),
            'tensor',
        )

        let slvResult: any = null
        const bit: any = {
            idx: 'test-audit',
            src: 'char_silas',
            slv: (res: any) => {
                slvResult = res
            },
        }

        await auditConditionVault(model, bit)

        expect(slvResult.voiBit.val).toBe(1)
        const audit = slvResult.voiBit.dat
        expect(audit.isConsistent).toBe(false)
        expect(audit.conditionsAudited).toHaveLength(3)
        expect(audit.missingVersions).toEqual(['char_silas_exhausted_v1.wav'])
        expect(audit.missingEmbeddings).toEqual(['char_silas_exhausted_v1.pt'])
        expect(audit.brokenSymlinks).toContain(
            'char_silas--exhausted.wav (missing)',
        )
        expect(
            audit.brokenSymlinks.some((s: string) =>
                s.startsWith('char_silas--whispered.wav -> '),
            ),
        ).toBe(true)
        expect(
            audit.discrepancies.some((d: string) =>
                d.startsWith(
                    'READ_ONLY_PERM_BREACH: char_silas_whispered_v2.wav',
                ),
            ),
        ).toBe(true)

        await expect(
            auditConditionVault(model, {
                idx: 'test-audit-strict',
                src: 'char_silas',
                dat: { strict: true },
            } as any),
        ).rejects.toThrow('CONDITION_VAULT_DRIFT_BREACH')
    })

    it('clears end-to-end audit on fully provisioned condition vault', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot
        const logs: string[] = []
        const ste = {
            hunt: async (_type: string, bit: any) => {
                logs.push(bit.src)
            },
        }

        for (const [conditionTag, somaticTrigger] of [
            ['combat_fatigue', 'pulmonary_strain'],
            ['whispered', 'covert_hush'],
        ]) {
            await registerConditionVariant(
                model,
                {
                    idx: 'e2e-register',
                    dat: {
                        characterSlug: 'char_silas',
                        conditionTag,
                        somaticTrigger,
                    },
                } as any,
                ste,
            )
            const takePath = path.join(
                testRoot,
                'voices',
                'versions',
                `char_silas_${conditionTag}_v1.wav`,
            )
            await fs.ensureDir(path.dirname(takePath))
            await fs.writeFile(takePath, 'audio')
            await fs.chmod(takePath, 0o444)
            await fs.ensureDir(path.join(testRoot, 'voices', 'embeddings'))
            await fs.writeFile(
                path.join(
                    testRoot,
                    'voices',
                    'embeddings',
                    `char_silas_${conditionTag}_v1.pt`,
                ),
                'tensor',
            )
            await retargetConditionSymlink(
                model,
                {
                    idx: 'e2e-retarget',
                    dat: {
                        characterSlug: 'char_silas',
                        conditionTag,
                        versionNumber: 1,
                    },
                } as any,
                ste,
            )
        }

        let slvResult: any = null
        await auditConditionVault(
            model,
            {
                idx: 'e2e-audit',
                src: 'char_silas',
                dat: { strict: true },
                slv: (res: any) => {
                    slvResult = res
                },
            } as any,
            ste,
        )

        const audit = slvResult.voiBit.dat
        expect(slvResult.voiBit.val).toBe(0)
        expect(audit.isConsistent).toBe(true)
        expect(audit.conditionsAudited).toHaveLength(2)
        expect(audit.missingVersions).toEqual([])
        expect(audit.missingEmbeddings).toEqual([])
        expect(audit.brokenSymlinks).toEqual([])
        expect(audit.discrepancies).toEqual([])
        expect(audit.conditionsAudited.every((c: any) => c.hasEmbedding)).toBe(
            true,
        )

        expect(logs).toContain(
            '>> [CONDITION:REGISTER] Registered condition [combat_fatigue] for [char_silas].',
        )
        expect(logs).toContain(
            '>> [SYMLINK:CONDITION] Swapped active condition pointer -> char_silas--whispered.wav.',
        )
        expect(logs[logs.length - 1]).toBe(
            '>> [VAULT:AUDIT] Condition vault audit for [char_silas]: [CONSISTENT] (2 condition(s)).',
        )
        expect(logs.every((l) => /^[\x20-\x7e]*$/.test(l))).toBe(true)
    })
})
