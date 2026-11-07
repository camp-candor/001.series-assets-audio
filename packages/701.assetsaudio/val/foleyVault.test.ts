import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import {
    auditVariationPoolDepth,
    initFoley,
    inspectFoleyWav,
    normalizeFoleyCueSlug,
    registerFoleyAsset,
    resolveFoleyCue,
    resolveFoleyCueSlug,
    selectDeterministicFoleyVariant,
    updateFoley,
    validateFoleyRegistry,
    verifyVariationPools,
} from '../02.foley.unit/buz/foley.buzz.js'
import { FoleyModel } from '../02.foley.unit/foley.model.js'
import { reducer } from '../02.foley.unit/foley.reduce.js'
import * as Act from '../02.foley.unit/foley.action.js'
import type {
    FoleyCueDefinition,
    FoleyRegistryManifest,
} from '../02.foley.unit/fce/foley.interface.js'

const repoRoot =
    typeof __dirname !== 'undefined'
        ? path.resolve(__dirname, '..', '..', '..')
        : process.cwd()

const CANONICAL_CUES: Record<string, string> = {
    rain_squall: 'locomotion',
    diesel_idle: 'locomotion',
    door_hiss: 'impacts',
    booth_creak: 'impacts',
    menu_drop: 'impacts',
    coffee_pour: 'handling',
    wipe_tear: 'handling',
    lens_click: 'handling',
    semi_pass: 'locomotion',
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
    buzz: (cpy: FoleyModel, bal: any, ste?: any) => Promise<FoleyModel>,
    root: string,
    dat: any = {},
    ste?: any,
): Promise<any> => {
    const model = new FoleyModel()
    model.foleyRoot = root
    let out: any = null
    await buzz(model, { idx: 'test', dat, slv: (r: any) => (out = r) }, ste)
    return out?.foleyBit
}

const loadRegistry = (): FoleyRegistryManifest =>
    fs.readJsonSync(path.join(repoRoot, 'foley', 'registry.json'))

describe('Parallax Dinner Foley Vault :: canonical registry and WAV pool', () => {
    const registry = loadRegistry()

    it('registers all 9 canonical cues with category and 3 variants each', () => {
        expect(registry.schema_version).toBe('1.0.0')
        expect(Object.keys(registry.cues).sort()).toEqual(
            Object.keys(CANONICAL_CUES).sort(),
        )
        for (const [slug, category] of Object.entries(CANONICAL_CUES)) {
            const cue = registry.cues[slug]
            expect(cue, `missing cue ${slug}`).toBeDefined()
            expect(cue.category).toBe(category)
            expect(cue.min_variants_required).toBe(3)
            expect(cue.variants).toHaveLength(3)
            for (const variant of cue.variants) {
                expect(variant.variant_id).toMatch(
                    new RegExp(`^${slug}_\\d{2}$`),
                )
                expect(variant.sha256).toMatch(/^[a-f0-9]{64}$/)
                expect(variant.sample_rate_hz).toBe(48000)
                expect(variant.bit_depth).toBe(24)
                expect(variant.channels).toBe(1)
                expect(variant.duration_ms).toBeGreaterThan(0)
                expect(variant.peak_dbfs).toBeLessThanOrEqual(0)
            }
        }
    })

    it('ships 27 physical WAV files with valid 48 kHz 24-bit PCM headers', () => {
        const allHashes = new Set<string>()
        let count = 0
        for (const cue of Object.values(registry.cues)) {
            for (const variant of cue.variants) {
                count++
                const wavPath = path.join(repoRoot, variant.wav_path)
                expect(
                    fs.existsSync(wavPath),
                    `missing ${variant.wav_path}`,
                ).toBe(true)
                const buf = fs.readFileSync(wavPath)
                expect(buf.length).toBeGreaterThan(1024)
                const inspection = inspectFoleyWav(wavPath)
                expect(inspection.valid).toBe(true)
                expect(inspection.sampleRateHz).toBe(48000)
                expect(inspection.bitDepth).toBe(24)
                expect(inspection.channels).toBe(1)
                const digest = createHash('sha256').update(buf).digest('hex')
                expect(digest).toBe(variant.sha256)
                allHashes.add(digest)
            }
        }
        expect(count).toBe(27)
        expect(allHashes.size).toBe(27)
    })

    it('files land in the canonical category directories', () => {
        const expectedDir: Record<string, string> = {
            impacts: 'impacts',
            locomotion: 'locomotion',
            handling: 'handling',
        }
        for (const cue of Object.values(registry.cues)) {
            for (const variant of cue.variants) {
                expect(
                    variant.wav_path.startsWith(
                        `foley/${expectedDir[cue.category]}/`,
                    ),
                ).toBe(true)
                expect(variant.wav_path).toContain(`/${cue.cue_slug}_`)
            }
        }
    })

    it('validateFoleyRegistry clears all 9 cues and emits REGISTRY:OK telemetry', async () => {
        const ste = makeSte()
        const res = await run(validateFoleyRegistry, repoRoot, {}, ste)
        expect(res.val).toBe(0)
        expect(res.dat.valid).toBe(true)
        expect(res.dat.cuesValidated).toHaveLength(9)
        expect(res.dat.totalVariants).toBe(27)
        expect(res.dat.breaches).toEqual([])
        expect(ste.lines).toContain(
            '>> [FOLEY:REGISTRY:OK] Verified 9 cues (27 physical WAV variants)',
        )
    })

    it('verifyVariationPools clears every pool', async () => {
        const ste = makeSte()
        const res = await run(verifyVariationPools, repoRoot, {}, ste)
        expect(res.val).toBe(0)
        expect(res.dat.valid).toBe(true)
        expect(res.dat.poolsChecked).toBe(9)
    })
})

describe('Parallax Dinner Foley Vault :: cue resolution parity', () => {
    it('resolveFoleyCue resolves bare slugs and namespaced foley:// URIs', async () => {
        for (const slug of Object.keys(CANONICAL_CUES)) {
            for (const raw of [
                slug,
                `foley://the_parallax_dinner/${slug}`,
                `FOLEY://${slug.toUpperCase()}`,
            ]) {
                const res = await run(resolveFoleyCue, repoRoot, {
                    cueSlug: raw,
                    sceneId: 'scene_01',
                    beatIndex: 3,
                })
                expect(res.val).toBe(0)
                expect(res.dat.statusCode).toBe('FOLEY_CUE_RESOLVED')
                expect(res.dat.cueSlug).toBe(slug)
                expect(res.dat.variant).not.toBeNull()
                expect(res.dat.selectedVariantIndex).toBeGreaterThanOrEqual(0)
                expect(res.dat.selectedVariantIndex).toBeLessThan(3)
            }
        }
    })

    it('resolveFoleyCueSlug strips URI prefixes', () => {
        const registry = loadRegistry()
        expect(
            resolveFoleyCueSlug(
                registry,
                'foley://the_parallax_dinner/coffee_pour',
            )?.cue_slug,
        ).toBe('coffee_pour')
        expect(normalizeFoleyCueSlug('foley://wiregrass/RAIN_SQUALL')).toBe(
            'rain_squall',
        )
    })

    it('fails closed with FOLEY_CUE_UNREGISTERED_BREACH on unknown cues', async () => {
        const ste = makeSte()
        let slv: any = null
        const model = new FoleyModel()
        model.foleyRoot = repoRoot
        await expect(
            resolveFoleyCue(
                model,
                {
                    idx: 't',
                    dat: { cueSlug: 'laser_sword_clash' },
                    slv: (r: any) => (slv = r),
                },
                ste,
            ),
        ).rejects.toThrow('FOLEY_CUE_UNREGISTERED_BREACH')
        expect(slv.foleyBit.val).toBe(-1)
        expect(slv.foleyBit.dat.statusCode).toBe(
            'FOLEY_CUE_UNREGISTERED_BREACH',
        )
        expect(
            ste.lines.some((l) => l.includes('FOLEY_CUE_UNREGISTERED_BREACH')),
        ).toBe(true)
    })

    it('fails closed when the registry file itself is missing', async () => {
        const emptyRoot = path.resolve(process.cwd(), '.tmp_test_foley_empty')
        await fs.ensureDir(emptyRoot)
        try {
            await expect(run(validateFoleyRegistry, emptyRoot)).rejects.toThrow(
                'FOLEY_REGISTRY_MISSING_BREACH',
            )
        } finally {
            await fs.remove(emptyRoot)
        }
    })
})

describe('Parallax Dinner Foley Vault :: variation pool balancer', () => {
    const registry = loadRegistry()
    const boothCreak = registry.cues.booth_creak
    const coffeePour = registry.cues.coffee_pour

    it('selectDeterministicFoleyVariant is deterministic per seed', () => {
        const a = selectDeterministicFoleyVariant(
            boothCreak,
            'scene_01:4:booth_creak',
        )
        const b = selectDeterministicFoleyVariant(
            boothCreak,
            'scene_01:4:booth_creak',
        )
        expect(a).toBe(b)
        expect(a).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThan(3)
    })

    it('never repeats the previous variant on consecutive triggers', () => {
        for (const cue of [boothCreak, coffeePour]) {
            const seedBase = 'diner:9:' + cue.cue_slug
            let previous = selectDeterministicFoleyVariant(cue, seedBase)
            const seen = new Set<number>([previous])
            for (let beat = 1; beat <= 24; beat++) {
                const next = selectDeterministicFoleyVariant(
                    cue,
                    `${seedBase}:${beat}`,
                    previous,
                )
                expect(next).not.toBe(previous)
                seen.add(next)
                previous = next
            }
            expect(seen.size).toBeGreaterThanOrEqual(2)
        }
    })

    it('auditVariationPoolDepth passes all canonical cues', () => {
        for (const cue of Object.values(registry.cues)) {
            const audit = auditVariationPoolDepth(cue, repoRoot)
            expect(audit.valid, audit.breaches.join(' | ')).toBe(true)
            expect(audit.variantCount).toBe(3)
            expect(audit.distinctHashes).toBe(3)
        }
    })

    it('traps FOLEY_VARIATION_POOL_STARVATION_BREACH below 3 variants', () => {
        const starved: FoleyCueDefinition = {
            ...boothCreak,
            variants: boothCreak.variants.slice(0, 2),
        }
        const audit = auditVariationPoolDepth(starved, repoRoot)
        expect(audit.valid).toBe(false)
        expect(audit.breaches.join('\n')).toContain(
            'FOLEY_VARIATION_POOL_STARVATION_BREACH',
        )
    })

    it('traps FOLEY_DUPLICATE_VARIANT_HASH_BREACH on copy-pasted variants', () => {
        const duplicated: FoleyCueDefinition = {
            ...coffeePour,
            variants: [
                coffeePour.variants[0],
                {
                    ...coffeePour.variants[1],
                    sha256: coffeePour.variants[0].sha256,
                },
                coffeePour.variants[2],
            ],
        }
        const audit = auditVariationPoolDepth(duplicated, repoRoot)
        expect(audit.valid).toBe(false)
        expect(audit.breaches.join('\n')).toContain(
            'FOLEY_DUPLICATE_VARIANT_HASH_BREACH',
        )
    })

    it('traps FOLEY_WAV_MISSING_OR_CORRUPT_BREACH on tampered files', () => {
        const corrupted: FoleyCueDefinition = {
            ...boothCreak,
            variants: boothCreak.variants.map((v, i) =>
                i === 0 ? { ...v, sha256: '0'.repeat(64) } : v,
            ),
        }
        const audit = auditVariationPoolDepth(corrupted, repoRoot)
        expect(audit.valid).toBe(false)
        expect(audit.breaches.join('\n')).toContain(
            'FOLEY_WAV_MISSING_OR_CORRUPT_BREACH',
        )
    })

    it('resolveFoleyCue surfaces pool breaches as breach status codes', async () => {
        const testRoot = path.resolve(process.cwd(), '.tmp_test_foley_pool')
        await fs.ensureDir(path.join(testRoot, 'foley'))
        const manifest: FoleyRegistryManifest = {
            schema_version: '1.0.0',
            series_scope: 'test',
            cues: {},
        }
        manifest.cues.broken_cue = {
            cue_slug: 'broken_cue',
            category: 'handling',
            description: 'broken',
            min_variants_required: 3,
            variants: [
                {
                    variant_id: 'broken_cue_01',
                    wav_path: 'foley/handling/broken_cue_01.wav',
                    sha256: 'a'.repeat(64),
                    sample_rate_hz: 48000,
                    bit_depth: 24,
                    channels: 1,
                    duration_ms: 100,
                    peak_dbfs: -3,
                },
            ],
        }
        await fs.writeJson(
            path.join(testRoot, 'foley', 'registry.json'),
            manifest,
        )
        try {
            let slv: any = null
            const model = new FoleyModel()
            model.foleyRoot = testRoot
            await expect(
                resolveFoleyCue(model, {
                    idx: 't',
                    dat: { cueSlug: 'broken_cue' },
                    slv: (r: any) => (slv = r),
                }),
            ).rejects.toThrow('FOLEY_VARIATION_POOL_STARVATION_BREACH')
            expect(slv.foleyBit.dat.statusCode).toBe(
                'FOLEY_VARIATION_POOL_STARVATION_BREACH',
            )
        } finally {
            await fs.remove(testRoot)
        }
    })
})

describe('Parallax Dinner Foley Vault :: asset registration', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_foley_register')
    const foleyDir = path.join(testRoot, 'foley')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(path.join(foleyDir, 'handling'))
        await fs.writeJson(path.join(foleyDir, 'registry.json'), {
            schema_version: '1.0.0',
            series_scope: 'test',
            cues: {},
        })
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    it('registerFoleyAsset validates a 48 kHz 24-bit WAV and appends the variant', async () => {
        const ste = makeSte()
        const srcWav = path.join(repoRoot, 'foley/handling/lens_click_01.wav')
        const destWav = path.join(foleyDir, 'handling', 'custom_click_01.wav')
        await fs.copy(srcWav, destWav)

        const res = await run(
            registerFoleyAsset,
            testRoot,
            {
                cueSlug: 'custom_click',
                wavPath: 'foley/handling/custom_click_01.wav',
                category: 'handling',
                description: 'Custom lens click variant.',
            },
            ste,
        )
        expect(res.val).toBe(1)
        expect(res.dat.variant.variant_id).toBe('custom_click_01')
        expect(res.dat.variant.sha256).toBe(
            createHash('sha256').update(fs.readFileSync(destWav)).digest('hex'),
        )
        expect(ste.lines.some((l) => l.startsWith('>> [FOLEY:REGISTER]'))).toBe(
            true,
        )

        const registry = await fs.readJson(path.join(foleyDir, 'registry.json'))
        expect(registry.cues.custom_click.variants).toHaveLength(1)
    })

    it('registerFoleyAsset rejects non-canonical WAV payloads', async () => {
        const badWav = path.join(foleyDir, 'handling', 'bad.wav')
        await fs.writeFile(badWav, Buffer.from('not a wav file at all'))
        await expect(
            run(registerFoleyAsset, testRoot, {
                cueSlug: 'bad_cue',
                wavPath: 'foley/handling/bad.wav',
            }),
        ).rejects.toThrow('FOLEY_WAV_MISSING_OR_CORRUPT_BREACH')

        const registry = await fs.readJson(path.join(foleyDir, 'registry.json'))
        expect(registry.cues.bad_cue).toBeUndefined()
    })
})

describe('Parallax Dinner Foley Vault :: reducer and telemetry', () => {
    it('reducer routes foley actions through clone(model, true)', async () => {
        const ste = makeSte()
        const model = new FoleyModel()
        model.foleyRoot = repoRoot
        let slv: any = null
        const next = await reducer(
            model,
            new Act.ResolveFoleyCue({
                idx: 't',
                dat: { cueSlug: 'coffee_pour', sceneId: 's1', beatIndex: 0 },
                slv: (r: any) => (slv = r),
            }),
            ste,
        )
        expect(next).not.toBe(model)
        expect(next.idx).toBe('02.foley')
        expect(slv.foleyBit.dat.statusCode).toBe('FOLEY_CUE_RESOLVED')

        const validated = await reducer(
            new FoleyModel(),
            new Act.ValidateFoleyRegistry({
                idx: 't',
                dat: { foleyRoot: repoRoot },
            }),
        )
        expect(validated.cuesRegistered).toBe(9)
        expect(validated.variantsVerified).toBe(27)

        const updated = await reducer(
            new FoleyModel(),
            new Act.UpdateFoley({ idx: 't', dat: { cuesRegistered: 9 } }),
        )
        expect(updated.cuesRegistered).toBe(9)
    })

    it('all cns00 telemetry is pure 7-bit ASCII', async () => {
        const ste = makeSte()
        await run(validateFoleyRegistry, repoRoot, {}, ste)
        await run(verifyVariationPools, repoRoot, {}, ste)
        await run(
            resolveFoleyCue,
            repoRoot,
            { cueSlug: 'menu_drop', sceneId: 's', beatIndex: 1 },
            ste,
        )
        await initFoley(new FoleyModel(), { idx: 'init' }, ste)
        expect(ste.lines.length).toBeGreaterThan(3)
        for (const line of ste.lines) {
            expect(line).toMatch(/^[\x20-\x7E]*$/)
        }
    })
})
