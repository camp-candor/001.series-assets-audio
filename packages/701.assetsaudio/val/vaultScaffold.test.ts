import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs-extra'
import path from 'path'
import { scaffoldVault } from '../01.voice.unit/buz/vaultScaffold.buzz.js'
import { syncFloatingSymlinks } from '../01.voice.unit/buz/symlinkSync.buzz.js'
import { VoiceModel } from '../01.voice.unit/voice.model.js'

describe('Vault Scaffold Feature Tests', () => {
    const testRoot = path.resolve(process.cwd(), '.tmp_test_vault_scaffold')

    beforeEach(async () => {
        await fs.remove(testRoot)
        await fs.ensureDir(testRoot)
    })

    afterEach(async () => {
        await fs.remove(testRoot)
    })

    it('scaffolds two-tier voice directory structure', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        let slvResult: any = null
        const bit: any = {
            idx: 'scaffold-test',
            src: testRoot,
            slv: (res: any) => {
                slvResult = res
            },
        }

        await scaffoldVault(model, bit)

        expect(slvResult).toBeDefined()
        expect(
            await fs.pathExists(path.join(testRoot, 'voices', 'versions')),
        ).toBe(true)
        expect(
            await fs.pathExists(path.join(testRoot, 'voices', 'active')),
        ).toBe(true)
        expect(
            await fs.pathExists(path.join(testRoot, 'voices', 'embeddings')),
        ).toBe(true)
    })

    it('resolves latest semantic version take into active symlink', async () => {
        const model = new VoiceModel()
        model.voicesRoot = testRoot

        const versionsDir = path.join(testRoot, 'voices', 'versions')
        await fs.ensureDir(versionsDir)

        // Create dummy versions
        await fs.writeFile(
            path.join(versionsDir, 'bog_v1.wav'),
            'fake-audio-v1',
        )
        await fs.writeFile(
            path.join(versionsDir, 'bog_v2.wav'),
            'fake-audio-v2',
        )

        let slvResult: any = null
        const bit: any = {
            idx: 'symlink-test',
            src: testRoot,
            dat: { characterSlug: 'bog' },
            slv: (res: any) => {
                slvResult = res
            },
        }

        await syncFloatingSymlinks(model, bit)

        expect(slvResult).toBeDefined()
        const activeFile = path.join(testRoot, 'voices', 'active', 'bog.wav')
        expect(await fs.pathExists(activeFile)).toBe(true)

        const target = await fs.readlink(activeFile)
        expect(target).toBe(path.join('..', 'versions', 'bog_v2.wav'))
    })
})
