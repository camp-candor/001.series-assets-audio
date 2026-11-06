import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'

export const computeBufferSha256 = async (
    filePath: string,
): Promise<string> => {
    const buf = await fs.readFile(filePath)
    return createHash('sha256').update(buf).digest('hex')
}

export const relocateVersionedTake = async (
    sourcePath: string,
    destVersionsDir: string,
    fileName: string,
): Promise<{ finalPath: string; sha256: string }> => {
    await fs.ensureDir(destVersionsDir)
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const stagePath = path.join(destVersionsDir, `.tmp_stage_${nonce}.wav`)

    // Stage copy in identical filesystem partition
    await fs.copy(sourcePath, stagePath)

    const sha256 = await computeBufferSha256(stagePath)
    const finalPath = path.join(destVersionsDir, fileName)

    // Atomic pointer swap
    await fs.rename(stagePath, finalPath)

    // Enforce POSIX 0444 read-only immutability
    await fs.chmod(finalPath, 0o444)

    return { finalPath, sha256 }
}
