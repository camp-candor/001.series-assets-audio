import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import {
    computeConsentDigest,
    evaluateLegalClearance,
    validateLegalClearanceToken,
    verifyTalentConsentSignature,
} from '../01.voice.unit/buz/legalTokenValidate.buzz.js'
import {
    auditOrphanTakes,
    encodeReferenceWav,
    lookupLexiconEntry,
    parseWavHeader,
    registerVoiceTake,
    resolveCharacterVoice,
    validateLexicon,
    validateVoiceManifest,
    verifySymlinkIntegrity,
} from '../01.voice.unit/buz/voice.buzz.js'
import { scaffoldVault } from '../01.voice.unit/buz/vaultScaffold.buzz.js'
import { VoiceModel } from '../01.voice.unit/voice.model.js'
import { reducer } from '../01.voice.unit/voice.reduce.js'
import * as Act from '../01.voice.unit/voice.action.js'

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
)
const LEADS = ['char_johnny_walkman', 'char_orbie_mayhaw']
const GOBLIN_ROSTER = [
    'char_bog',
    'char_fib',
    'char_mum_grissel',
    'char_wattle',
    'char_gaffer_sludge',
]

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
    buzz: (cpy: VoiceModel, bal: any, ste?: any) => Promise<VoiceModel>,
    vaultRoot: string,
    dat: any = {},
    ste?: any,
): Promise<any> => {
    const model = new VoiceModel()
    model.voicesRoot = vaultRoot
    let out: any = null
    await buzz(model, { idx: 'test', dat, slv: (r: any) => (out = r) }, ste)
    return out?.voiBit
}

const clearanceFor = (slug: string, token = 'CLR-WG26-0099') => {
    const base = {
        characterSlug: slug,
        clearanceToken: token,
        talentIdentifier: 'TALENT-TEST-001',
        signedAtIso: '2026-11-06T00:00:00.000Z',
    }
    return {
        ...base,
        consentVerified: true,
        jurisdiction: 'US-GA-WIREGRASS' as const,
        sha256ConsentDigest: computeConsentDigest(base),
    }
}

describe('Wiregrass Basin Voice Vault :: legal clearance ingress', () => {
    it('verifies CLR-WG26-0001 and emits LEGAL:PASS telemetry', async () => {
        const ste = makeSte()
        const res = await run(
            validateLegalClearanceToken,
            repoRoot,
            clearanceFor('char_johnny_walkman', 'CLR-WG26-0001'),
            ste,
        )
        expect(res.val).toBe(0)
        expect(res.dat.statusCode).toBe('CLEARANCE_VERIFIED')
        expect(ste.lines).toContain(
            '>> [LEGAL:PASS] Character [char_johnny_walkman] clearance verified (CLR-WG26-0001)',
        )
    })

    it.each([
        [{ clearanceToken: '' }, 'LEGAL_CLEARANCE_MISSING_BREACH'],
        [{ clearanceToken: undefined }, 'LEGAL_CLEARANCE_MISSING_BREACH'],
        [{ clearanceToken: 'CLR-wg26-0001' }, 'LEGAL_TOKEN_FORMAT_BREACH'],
        [{ clearanceToken: 'CLR-ABC-0001' }, 'LEGAL_TOKEN_FORMAT_BREACH'],
        [{ clearanceToken: 'CLR-WG26-001' }, 'LEGAL_TOKEN_FORMAT_BREACH'],
        [{ consentVerified: false }, 'TALENT_CONSENT_UNVERIFIED_BREACH'],
        [{ consentVerified: 'true' }, 'TALENT_CONSENT_UNVERIFIED_BREACH'],
        [{ sha256ConsentDigest: 'abc' }, 'CONSENT_DIGEST_MISMATCH_BREACH'],
        [
            { sha256ConsentDigest: 'A'.repeat(64) },
            'CONSENT_DIGEST_MISMATCH_BREACH',
        ],
    ])('rejects %o with %s', async (override, code) => {
        const record: any = {
            ...clearanceFor('char_orbie_mayhaw'),
            ...override,
        }
        expect(evaluateLegalClearance(record).statusCode).toBe(code)

        const ste = makeSte()
        let slv: any = null
        await expect(
            validateLegalClearanceToken(
                new VoiceModel(),
                { idx: 't', dat: record, slv: (r: any) => (slv = r) },
                ste,
            ),
        ).rejects.toThrow(code)
        expect(slv.voiBit.val).toBe(-1)
        expect(
            ste.lines.some((l) => l.startsWith(`>> [LEGAL:HALT] ${code}:`)),
        ).toBe(true)
    })

    it('verifyTalentConsentSignature checks consent flag and digest shape', () => {
        const ok = clearanceFor('char_bog')
        expect(verifyTalentConsentSignature(ok).valid).toBe(true)
        expect(
            verifyTalentConsentSignature({ ...ok, consentVerified: false })
                .statusCode,
        ).toBe('TALENT_CONSENT_UNVERIFIED_BREACH')
        expect(
            verifyTalentConsentSignature({ ...ok, sha256ConsentDigest: '' })
                .statusCode,
        ).toBe('CONSENT_DIGEST_MISMATCH_BREACH')
    })
})

describe('Wiregrass Basin Voice Vault :: canonical repository vault', () => {
    const voicesDir = path.join(repoRoot, 'voices')

    it('materializes 48 kHz 24-bit mono reference takes sealed by manifest digests', async () => {
        await scaffoldVault(new VoiceModel(), { idx: 'seal', src: repoRoot })
        const manifest = await fs.readJson(
            path.join(voicesDir, 'voice_manifest.json'),
        )
        for (const slug of LEADS) {
            const entry = manifest.voices[slug]
            expect(entry.reference_wav_path).toBe(
                `voices/versions/${slug}_v1.wav`,
            )
            const wavPath = path.join(repoRoot, entry.reference_wav_path)
            const buf = await fs.readFile(wavPath)
            expect(buf.length).toBeGreaterThan(1024)
            const header = parseWavHeader(buf)
            expect(header).toMatchObject({
                isRiffWave: true,
                audioFormat: 1,
                sampleRateHz: 48000,
                bitDepth: 24,
                channels: 1,
            })
            expect(createHash('sha256').update(buf).digest('hex')).toBe(
                entry.sha256,
            )
            expect((await fs.stat(wavPath)).mode & 0o777).toBe(0o444)
            expect(entry.legal_clearance_token).toMatch(/^CLR-WG26-000[12]$/)
            expect(entry.consent_verified).toBe(true)
            expect(Object.keys(entry.conditions).sort()).toEqual([
                'neutral',
                'tense',
                'weary',
                'whispering',
            ])
            expect(
                await fs.pathExists(
                    path.join(voicesDir, 'embeddings', `${slug}_v1.pt`),
                ),
            ).toBe(true)
        }
        expect(manifest.voices.char_johnny_walkman.display_name).toBe(
            'Johnny Walkman',
        )
        expect(manifest.voices.char_orbie_mayhaw.display_name).toBe(
            'Orbie Mayhaw',
        )
        for (const slug of GOBLIN_ROSTER)
            expect(manifest.voices[slug]).toBeDefined()
    })

    it('validateVoiceManifest clears both leads and flags roster entries as pending', async () => {
        const ste = makeSte()
        const res = await run(
            validateVoiceManifest,
            repoRoot,
            { strict: true },
            ste,
        )
        expect(res.val).toBe(0)
        expect(res.dat.charactersValidated).toEqual(
            expect.arrayContaining(LEADS),
        )
        expect(res.dat.rosterPending).toEqual(
            expect.arrayContaining(GOBLIN_ROSTER),
        )

        const strictAll = await run(validateVoiceManifest, repoRoot, {
            requireAllCleared: true,
        })
        expect(strictAll.val).toBe(1)
        expect(strictAll.dat.breaches.join('\n')).toContain(
            'LEGAL_CLEARANCE_MISSING_BREACH: [char_bog]',
        )
    })

    it('resolveCharacterVoice resolves both leads, conditions, and traps unknown characters', async () => {
        for (const slug of LEADS) {
            const res = await run(resolveCharacterVoice, repoRoot, {
                characterId: slug,
            })
            expect(res.dat.referenceWavPath).toBe(
                path.join(voicesDir, 'versions', `${slug}_v1.wav`),
            )
            expect(res.dat.activePointerPath).toBe(
                path.join(voicesDir, 'active', `${slug}.wav`),
            )
            expect(res.dat.embeddingPath).toBe(
                path.join(voicesDir, 'embeddings', `${slug}_v1.pt`),
            )
            expect(res.dat.referenceExists).toBe(true)
            expect(res.dat.embeddingExists).toBe(true)
            expect(res.dat.sha256).toMatch(/^[a-f0-9]{64}$/)
        }
        const weary = await run(resolveCharacterVoice, repoRoot, {
            characterId: 'char_orbie_mayhaw',
            condition: 'weary',
        })
        expect(weary.dat.condition).toBe('weary')
        expect(weary.dat.referenceWavRelPath).toBe(
            'voices/versions/char_orbie_mayhaw_v1.wav',
        )

        let slv: any = null
        const model = new VoiceModel()
        model.voicesRoot = repoRoot
        await expect(
            resolveCharacterVoice(model, {
                idx: 't',
                dat: { characterId: 'char_nobody' },
                slv: (r: any) => (slv = r),
            }),
        ).rejects.toThrow('VOICE_CHARACTER_UNREGISTERED_BREACH')
        expect(slv.voiBit.val).toBe(-1)
        await expect(
            resolveCharacterVoice(model, {
                idx: 't',
                dat: {
                    characterId: 'char_johnny_walkman',
                    condition: 'ecstatic',
                },
            }),
        ).rejects.toThrow('VOICE_CONDITION_UNREGISTERED_BREACH')
    })

    it('validateLexicon confirms Wiregrass and optometry phonetic overrides', async () => {
        const res = await run(validateLexicon, repoRoot, { strict: true })
        expect(res.val).toBe(0)
        expect(res.dat.missingTerms).toEqual([])
        const lexicon = await fs.readJson(path.join(voicesDir, 'lexicon.json'))
        expect(lookupLexiconEntry(lexicon, 'Mayhaw')).toMatchObject({
            arpabet: 'M EY1 HH AO2',
            ipa: '/meI.hO/',
            category: 'REGIONAL_DIALECT',
        })
        expect(lookupLexiconEntry(lexicon, 'okefenokee')?.arpabet).toBe(
            'OW2 K AH0 F AH0 N OW1 K IY0',
        )
        expect(lookupLexiconEntry(lexicon, 'astigmatism')?.ipa).toBe(
            '/@.stIg.m@.tIz.@m/',
        )
        expect(lookupLexiconEntry(lexicon, 'Phoropter')?.category).toBe(
            'CLINICAL_OPTOMETRY',
        )
        for (const lore of ['Grissel', 'Wattle', 'Candor']) {
            expect(lookupLexiconEntry(lexicon, lore)?.category).toBe(
                'LORE_TERM',
            )
        }
    })

    it('active pointers are intact and no orphan takes exist', async () => {
        const links = await run(verifySymlinkIntegrity, repoRoot, {
            strict: true,
        })
        expect(links.dat.intact).toBe(true)
        const names = links.dat.checked.map((c: any) => c.pointerName)
        expect(names).toEqual(
            expect.arrayContaining(LEADS.map((s) => `${s}.wav`)),
        )

        const orphans = await run(auditOrphanTakes, repoRoot, { strict: true })
        expect(orphans.dat.orphans).toEqual([])
    })
})

describe('Wiregrass Basin Voice Vault :: isolated vault controls', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_wiregrass_vault')
    const voicesDir = path.join(testRoot, 'voices')
    const srcDir = path.join(testRoot, 'incoming')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(srcDir)
        await fs.ensureDir(voicesDir)
        await fs.writeJson(path.join(voicesDir, 'voice_manifest.json'), {
            voices: {},
        })
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    const writeSource = async (name: string, buf?: Buffer) => {
        const p = path.join(srcDir, name)
        await fs.writeFile(
            p,
            buf || encodeReferenceWav({ fundamentalHz: 140, durationSec: 0.1 }),
        )
        return p
    }

    const register = async (
        slug: string,
        sourceWavPath: string,
        clearance: any,
        ste?: any,
    ) =>
        run(
            registerVoiceTake,
            testRoot,
            { characterSlug: slug, sourceWavPath, clearance },
            ste,
        )

    it('registerVoiceTake seals a cleared take and keeps the vault consistent', async () => {
        const ste = makeSte()
        const src = await writeSource('take.wav')
        const res = await register(
            'char_test_lead',
            src,
            clearanceFor('char_test_lead'),
            ste,
        )
        expect(res.val).toBe(1)

        const dest = path.join(voicesDir, 'versions', 'char_test_lead_v1.wav')
        expect((await fs.stat(dest)).mode & 0o777).toBe(0o444)
        const manifest = await fs.readJson(
            path.join(voicesDir, 'voice_manifest.json'),
        )
        const entry = manifest.voices.char_test_lead
        expect(entry.sha256).toBe(
            createHash('sha256')
                .update(await fs.readFile(src))
                .digest('hex'),
        )
        expect(entry.legal_clearance_token).toBe('CLR-WG26-0099')
        expect(entry.consent_verified).toBe(true)
        expect(ste.lines).toContain(
            '>> [VOICE:REGISTER] Registered char_test_lead (v1)',
        )

        const second = await register(
            'char_test_lead',
            await writeSource(
                'take2.wav',
                encodeReferenceWav({ fundamentalHz: 150, durationSec: 0.1 }),
            ),
            clearanceFor('char_test_lead'),
        )
        expect(second.val).toBe(2)
        expect(second.dat.version_history).toEqual([
            'voices/versions/char_test_lead_v1.wav',
        ])

        expect((await run(validateVoiceManifest, testRoot)).val).toBe(0)
        expect((await run(verifySymlinkIntegrity, testRoot)).dat.intact).toBe(
            true,
        )
        expect((await run(auditOrphanTakes, testRoot)).dat.orphans).toEqual([])
    })

    it('registerVoiceTake rejects uncleared or non-canonical takes before touching the vault', async () => {
        const src = await writeSource('take.wav')
        await expect(
            register('char_test_lead', src, {
                ...clearanceFor('char_test_lead'),
                clearanceToken: '',
            }),
        ).rejects.toThrow('LEGAL_CLEARANCE_MISSING_BREACH')
        await expect(
            register('char_test_lead', src, {
                ...clearanceFor('char_test_lead'),
                consentVerified: false,
            }),
        ).rejects.toThrow('TALENT_CONSENT_UNVERIFIED_BREACH')

        const wrongRate = encodeReferenceWav({
            fundamentalHz: 140,
            durationSec: 0.1,
        })
        wrongRate.writeUInt32LE(44100, 24)
        await expect(
            register(
                'char_test_lead',
                await writeSource('bad.wav', wrongRate),
                clearanceFor('char_test_lead'),
            ),
        ).rejects.toThrow('VOICE_TAKE_FORMAT_BREACH')
        await expect(
            register(
                'char_test_lead',
                await writeSource('tiny.wav', Buffer.from('RIFF....WAVE')),
                clearanceFor('char_test_lead'),
            ),
        ).rejects.toThrow('VOICE_TAKE_FORMAT_BREACH')

        expect(
            await fs.pathExists(
                path.join(voicesDir, 'versions', 'char_test_lead_v1.wav'),
            ),
        ).toBe(false)
        const manifest = await fs.readJson(
            path.join(voicesDir, 'voice_manifest.json'),
        )
        expect(manifest.voices.char_test_lead).toBeUndefined()
    })

    it('verifySymlinkIntegrity flags dangling and mismatched active pointers', async () => {
        await register(
            'char_a',
            await writeSource('a.wav'),
            clearanceFor('char_a'),
        )
        await register(
            'char_b',
            await writeSource('b.wav'),
            clearanceFor('char_b'),
        )
        await register(
            'char_b',
            await writeSource(
                'b2.wav',
                encodeReferenceWav({ fundamentalHz: 99, durationSec: 0.1 }),
            ),
            clearanceFor('char_b'),
        )

        const activeDir = path.join(voicesDir, 'active')
        await fs.remove(path.join(activeDir, 'char_a.wav'))
        await fs.symlink(
            '../versions/char_a_v9.wav',
            path.join(activeDir, 'char_a.wav'),
        )
        await fs.remove(path.join(activeDir, 'char_b.wav'))
        await fs.symlink(
            '../versions/char_b_v1.wav',
            path.join(activeDir, 'char_b.wav'),
        )

        const report = await run(verifySymlinkIntegrity, testRoot)
        expect(report.val).toBe(1)
        expect(report.dat.dangling).toEqual(['char_a.wav'])
        expect(report.dat.mismatched).toEqual(['char_b.wav'])

        const model = new VoiceModel()
        model.voicesRoot = testRoot
        await expect(
            verifySymlinkIntegrity(model, { idx: 't', dat: { strict: true } }),
        ).rejects.toThrow('DANGLING_ACTIVE_VOICE_SYMLINK')

        await fs.remove(path.join(activeDir, 'char_a.wav'))
        const missing = await run(verifySymlinkIntegrity, testRoot)
        expect(missing.dat.dangling).toEqual(['char_a.wav'])
    })

    it('verifySymlinkIntegrity accepts text pointer files from symlink-less checkouts', async () => {
        await register(
            'char_a',
            await writeSource('a.wav'),
            clearanceFor('char_a'),
        )
        const pointer = path.join(voicesDir, 'active', 'char_a.wav')
        await fs.remove(pointer)
        await fs.writeFile(pointer, '../versions/char_a_v1.wav')
        const report = await run(verifySymlinkIntegrity, testRoot)
        expect(report.dat.intact).toBe(true)
        expect(report.dat.checked[0].kind).toBe('pointer-file')
    })

    it('auditOrphanTakes flags unreferenced takes', async () => {
        await register(
            'char_a',
            await writeSource('a.wav'),
            clearanceFor('char_a'),
        )
        const clean = await run(auditOrphanTakes, testRoot)
        expect(clean.val).toBe(0)

        await fs.writeFile(
            path.join(voicesDir, 'versions', 'char_ghost_v1.wav'),
            'x',
        )
        const ste = makeSte()
        const dirty = await run(auditOrphanTakes, testRoot, {}, ste)
        expect(dirty.dat.orphans).toEqual(['char_ghost_v1.wav'])
        expect(
            ste.lines.some((l) =>
                l.includes(
                    'ORPHAN_VOICE_TAKE_DETECTED: versions/char_ghost_v1.wav',
                ),
            ),
        ).toBe(true)

        const model = new VoiceModel()
        model.voicesRoot = testRoot
        await expect(
            auditOrphanTakes(model, { idx: 't', dat: { strict: true } }),
        ).rejects.toThrow('ORPHAN_VOICE_TAKE_DETECTED')
    })

    it('reducer routes phase-one actions and all telemetry is 7-bit ASCII', async () => {
        const ste = makeSte()
        await register(
            'char_a',
            await writeSource('a.wav'),
            clearanceFor('char_a'),
            ste,
        )
        const model = new VoiceModel()
        model.voicesRoot = testRoot
        let slv: any = null
        const next = await reducer(
            model,
            new Act.ResolveCharacterVoice({
                idx: 't',
                dat: { characterId: 'char_a' },
                slv: (r: any) => (slv = r),
            }),
            ste,
        )
        expect(next).not.toBe(model)
        expect(slv.voiBit.dat.characterId).toBe('char_a')

        for (const buzz of [
            validateVoiceManifest,
            validateLexicon,
            verifySymlinkIntegrity,
            auditOrphanTakes,
        ]) {
            await run(buzz, testRoot, {}, ste)
        }
        expect(ste.lines.length).toBeGreaterThan(5)
        for (const line of ste.lines) expect(line).toMatch(/^[\x20-\x7E]*$/)
    })
})
