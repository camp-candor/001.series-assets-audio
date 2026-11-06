import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import {
    inspectAudioBuffer,
    auditPoisonBuffers,
    EMPTY_STRING_SHA256,
} from '../00.assetsaudio.unit/buz/poisonSentinel.buzz.js'
import { AssetsAudioModel } from '../00.assetsaudio.unit/assetsaudio.model.js'

describe('Poison Sentinel Boundary Tests', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_poison_sentinel')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(testRoot)
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    it('rejects zero-byte audio files', async () => {
        const zeroFile = path.join(testRoot, 'silent.wav')
        await fs.writeFile(zeroFile, '')

        const report = await inspectAudioBuffer(zeroFile)
        expect(report.status).toBe('FAILED')
        expect(report.sha256).toBe(EMPTY_STRING_SHA256)
        expect(report.error).toContain('ZERO_BYTE_POISON_BREACH')
    })

    it('rejects unhydrated LFS pointer files below 1024 bytes', async () => {
        const pointerFile = path.join(testRoot, 'pointer.wav')
        const lfsPointerText =
            'version https://git-lfs.github.com/spec/v1\noid sha256:4d7a...128\nsize 4500000\n'
        await fs.writeFile(pointerFile, lfsPointerText)

        const report = await inspectAudioBuffer(pointerFile)
        expect(report.status).toBe('FAILED')
        expect(report.byteSize).toBeLessThan(1024)
        expect(report.error).toContain('UNHYDRATED_LFS_POINTER_BREACH')
    })

    it('passes fully hydrated linear PCM buffers', async () => {
        const validFile = path.join(testRoot, 'valid.wav')
        const validBuffer = Buffer.alloc(2048, 0x7f)
        await fs.writeFile(validFile, validBuffer)

        const report = await inspectAudioBuffer(validFile)
        expect(report.status).toBe('PASSED')
        expect(report.isHydrated).toBe(true)
        expect(report.byteSize).toBe(2048)
    })

    it('throws fail-closed error during directory audit sweep on poison detection', async () => {
        const model = new AssetsAudioModel()
        model.vaultRoot = testRoot

        const voicesDir = path.join(testRoot, 'voices')
        await fs.ensureDir(voicesDir)
        await fs.writeFile(path.join(voicesDir, 'poison.wav'), '')

        const bit: any = {
            idx: 'audit-poison',
            src: voicesDir,
        }

        await expect(auditPoisonBuffers(model, bit)).rejects.toThrow(
            'POISON_AUDIT_BREACH',
        )
    })
})
