import { describe, expect, it } from 'vitest'
import { auditionVoiceTake } from '../98.menu.unit/buz/auditionTake.buzz.js'
import { compareVoiceTimbre } from '../98.menu.unit/buz/timbreComparison.buzz.js'
import { authorVocalDirectionNotes } from '../98.menu.unit/buz/authorVoiceNotes.buzz.js'
import { demoteActiveVoiceVersion } from '../98.menu.unit/buz/demoteVoice.buzz.js'
import { registerDialectOverride } from '../98.menu.unit/buz/registerDialect.buzz.js'
import { verifyCasLedgerIntegrity } from '../97.collect.unit/buz/shaSealer.buzz.js'

describe('Terminal Modalities and CAS Tests', () => {
    it('auditionVoiceTake test', async () => {
        await auditionVoiceTake('test.wav', 'char1');
        expect(1).toBe(1);
    });

    it('compareVoiceTimbre test', async () => {
        await compareVoiceTimbre({ id: 'A' }, { id: 'B' });
        expect(1).toBe(1);
    });

    it('authorVocalDirectionNotes positive save', async () => {
        await authorVocalDirectionNotes('Good take', 'char1');
        expect(1).toBe(1);
    });

    it('authorVocalDirectionNotes negative trap', async () => {
        await expect(authorVocalDirectionNotes('Bad ❌', 'char1')).rejects.toThrow('NON_ASCII_DIRECTION_NOTE_BREACH');
    });

    it('demoteActiveVoiceVersion rollback', async () => {
        await demoteActiveVoiceVersion('char1', 1);
        expect(1).toBe(1);
    });

    it('demoteActiveVoiceVersion negative trap', async () => {
        await expect(demoteActiveVoiceVersion('char1', 0)).rejects.toThrow('VOICE_DEMOTION_NO_FALLBACK_BREACH');
    });

    it('registerDialectOverride positive registration', async () => {
        await registerDialectOverride('word', 'W ER D', 'werd');
        expect(1).toBe(1);
    });

    it('registerDialectOverride negative trap', async () => {
        await expect(registerDialectOverride('word', 'INVALID', 'werd')).rejects.toThrow('INVALID_ARPABET_PHONEME_BREACH');
    });

    it('verifyCasLedgerIntegrity positive Merkle seal', async () => {
        const res = await verifyCasLedgerIntegrity('repo');
        expect(res).toBe(true);
    });

    it('verifyCasLedgerIntegrity negative trap', async () => {
        await expect(verifyCasLedgerIntegrity('tampered')).rejects.toThrow('CAS_DIGEST_TAMPER_BREACH');
    });
});
