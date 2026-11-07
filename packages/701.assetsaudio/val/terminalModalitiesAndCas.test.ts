import { describe, it, expect } from 'vitest'
import { auditionVoiceTake } from '../98.menu.unit/buz/auditionTake.buzz.js'
import { compareVoiceTimbre } from '../98.menu.unit/buz/timbreComparison.buzz.js'
import { authorVocalDirectionNotes } from '../98.menu.unit/buz/authorVoiceNotes.buzz.js'
import { demoteActiveVoiceVersion } from '../98.menu.unit/buz/demoteVoice.buzz.js'
import { registerDialectOverride } from '../98.menu.unit/buz/registerDialect.buzz.js'
import { computeAndSealAssetSha256, verifyCasLedgerIntegrity } from '../97.collect.unit/buz/shaSealer.buzz.js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('Terminal Modalities and CAS Test Suite', () => {
    it('auditionVoiceTake telemetry', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audition-'))
        const wavPath = path.join(tempDir, 'test.wav')
        fs.writeFileSync(wavPath, 'fake wav content')

        const telemetry = await auditionVoiceTake('test_char', wavPath)
        expect(telemetry).toContain('>> [AUDITION:PLAY]')
        expect(telemetry).toContain('Duration=1500ms')
    })

    it('compareVoiceTimbre output', () => {
        const takeA = { id: 'v1' }
        const takeB = { id: 'v2' }
        const res = compareVoiceTimbre(takeA, takeB)
        expect(res).toBe('>> [TIMBRE:COMPARE] v1 vs v2')
    })

    it('authorVocalDirectionNotes positive and negative', async () => {
        await expect(authorVocalDirectionNotes('char', 'Valid ASCII')).resolves.not.toThrow()
        await expect(authorVocalDirectionNotes('char', 'Invalid ASCII: 😊')).rejects.toThrow('NON_ASCII_DIRECTION_NOTE_BREACH')
    })

    it('demoteActiveVoiceVersion positive and negative', async () => {
        await expect(demoteActiveVoiceVersion('char', 1)).resolves.not.toThrow()
        await expect(demoteActiveVoiceVersion('char', 0)).rejects.toThrow('VOICE_DEMOTION_NO_FALLBACK_BREACH')
    })

    it('registerDialectOverride positive and negative', async () => {
        await expect(registerDialectOverride('word', 'AH0', 'valid ipa')).resolves.not.toThrow()
        await expect(registerDialectOverride('word', 'ah0', 'valid ipa')).rejects.toThrow('INVALID_ARPABET_PHONEME_BREACH')
    })

    it('verifyCasLedgerIntegrity positive and negative', () => {
        expect(verifyCasLedgerIntegrity('valid_repo')).toBe(true)
        expect(() => verifyCasLedgerIntegrity('mutated_repo')).toThrow('CAS_DIGEST_TAMPER_BREACH')
    })
})
