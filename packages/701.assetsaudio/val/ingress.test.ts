import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import {
    inspectAudioInode,
    validateSourceInode,
} from '../01.voice.unit/buz/ingressValidate.buzz.js'
import { promptSourcePath } from '../84.input.unit/buz/pathPrompt.buzz.js'
import { VoiceModel } from '../01.voice.unit/voice.model.js'
import { InputModel } from '../84.input.unit/input.model.js'

describe('Source Audio Filesystem Ingress Feature Tests', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_ingress')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(testRoot)
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    it('prompts source path in headless test mode and captures default value', () => {
        const model = new InputModel()
        let slvResult: any = null

        const bit: any = {
            idx: 'test-prompt',
            src: 'samples/take.wav',
            slv: (res: any) => {
                slvResult = res
            },
        }

        promptSourcePath(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.putBit.src).toBe('samples/take.wav')
        expect(slvResult.putBit.dat.submitted).toBe(true)
        expect(model.lastPromptValue).toBe('samples/take.wav')
    })

    it('rejects validation when path string is empty', async () => {
        const report = await inspectAudioInode('', testRoot)
        expect(report.status).toBe('INVALID')
        expect(report.error).toContain('FILE_PATH_EMPTY_BREACH')
    })

    it('rejects validation when target file does not exist on disk', async () => {
        const missing = path.join(testRoot, 'non_existent.wav')
        const report = await inspectAudioInode(missing, testRoot)
        expect(report.status).toBe('INVALID')
        expect(report.exists).toBe(false)
        expect(report.error).toContain('FILE_NOT_FOUND_BREACH')
    })

    it('rejects validation when target path points to a directory', async () => {
        const subDir = path.join(testRoot, 'voices_dir')
        await fs.ensureDir(subDir)

        const report = await inspectAudioInode(subDir, testRoot)
        expect(report.status).toBe('INVALID')
        expect(report.isFile).toBe(false)
        expect(report.error).toContain('NOT_A_FILE_BREACH')
    })

    it('rejects validation when target file has zero byte size', async () => {
        const zeroFile = path.join(testRoot, 'empty.wav')
        await fs.writeFile(zeroFile, '')

        const report = await inspectAudioInode(zeroFile, testRoot)
        expect(report.status).toBe('INVALID')
        expect(report.byteSize).toBe(0)
        expect(report.error).toContain('ZERO_BYTE_INGRESS_BREACH')
    })

    it('rejects validation when file has an unsupported container extension', async () => {
        const textFile = path.join(testRoot, 'notes.txt')
        await fs.writeFile(textFile, 'vocal notes')

        const report = await inspectAudioInode(textFile, testRoot)
        expect(report.status).toBe('INVALID')
        expect(report.error).toContain('UNSUPPORTED_CONTAINER_BREACH')
    })

    it('validates and locks audio file when valid container exists with non-zero size', async () => {
        const wavFile = path.join(testRoot, 'valid_take.wav')
        const buffer = Buffer.alloc(2048, 0x12)
        await fs.writeFile(wavFile, buffer)

        const report = await inspectAudioInode(wavFile, testRoot)
        expect(report.status).toBe('VALID')
        expect(report.exists).toBe(true)
        expect(report.isFile).toBe(true)
        expect(report.byteSize).toBe(2048)
        expect(report.extension).toBe('.wav')
    })

    it('executes validateSourceInode buzzer and resolves successfully', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const flacFile = path.join(testRoot, 'take.flac')
        await fs.writeFile(flacFile, Buffer.alloc(4096, 0x34))

        let slvResult: any = null
        const bit: any = {
            idx: 'test-validate',
            src: flacFile,
            slv: (res: any) => {
                slvResult = res
            },
        }

        await validateSourceInode(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.voiBit.idx).toBe('validate-source-inode')
        expect(slvResult.voiBit.val).toBe(4096)
        expect(slvResult.voiBit.dat.status).toBe('VALID')
    })

    it('throws breach error in validateSourceInode buzzer on invalid file', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const bit: any = {
            idx: 'test-validate-fail',
            src: path.join(testRoot, 'ghost.wav'),
        }

        await expect(validateSourceInode(model, bit)).rejects.toThrow(
            'FILE_NOT_FOUND_BREACH',
        )
    })
})
