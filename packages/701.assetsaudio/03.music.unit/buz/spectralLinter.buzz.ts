import type {
    LoopBoundaryAuditResult,
    MusicStemDefinition,
} from '../fce/music.interface.js'

export interface WavPcmInspection {
    valid: boolean
    riff: boolean
    wave: boolean
    audioFormat: number
    channels: number
    sampleRateHz: number
    byteRate: number
    blockAlign: number
    bitDepth: number
    dataOffset: number
    dataBytes: number
    fileBytes: number
    breaches: string[]
}

const emptyInspection = (fileBytes: number): WavPcmInspection => ({
    valid: false,
    riff: false,
    wave: false,
    audioFormat: 0,
    channels: 0,
    sampleRateHz: 0,
    byteRate: 0,
    blockAlign: 0,
    bitDepth: 0,
    dataOffset: -1,
    dataBytes: 0,
    fileBytes,
    breaches: [],
})

export const inspectWavPcm = (wavBuffer: Buffer): WavPcmInspection => {
    const inspection = emptyInspection(wavBuffer.length)
    if (wavBuffer.length < 12) {
        inspection.breaches.push('buffer is too small for a RIFF/WAVE header')
        return inspection
    }

    inspection.riff = wavBuffer.toString('ascii', 0, 4) === 'RIFF'
    inspection.wave = wavBuffer.toString('ascii', 8, 12) === 'WAVE'
    if (!inspection.riff) inspection.breaches.push('missing RIFF magic')
    if (!inspection.wave) inspection.breaches.push('missing WAVE magic')
    if (!inspection.riff || !inspection.wave) return inspection

    let offset = 12
    let foundFmt = false
    let foundData = false
    while (offset + 8 <= wavBuffer.length) {
        const chunkId = wavBuffer.toString('ascii', offset, offset + 4)
        const chunkSize = wavBuffer.readUInt32LE(offset + 4)
        const body = offset + 8
        if (body + chunkSize > wavBuffer.length) {
            inspection.breaches.push(
                `chunk [${chunkId}] declares ${chunkSize} bytes beyond buffer end`,
            )
            break
        }

        if (chunkId === 'fmt ' && chunkSize >= 16) {
            inspection.audioFormat = wavBuffer.readUInt16LE(body)
            inspection.channels = wavBuffer.readUInt16LE(body + 2)
            inspection.sampleRateHz = wavBuffer.readUInt32LE(body + 4)
            inspection.byteRate = wavBuffer.readUInt32LE(body + 8)
            inspection.blockAlign = wavBuffer.readUInt16LE(body + 12)
            inspection.bitDepth = wavBuffer.readUInt16LE(body + 14)
            foundFmt = true
        } else if (chunkId === 'data') {
            inspection.dataOffset = body
            inspection.dataBytes = chunkSize
            foundData = true
        }

        offset = body + chunkSize + (chunkSize % 2)
    }

    if (!foundFmt) inspection.breaches.push('missing fmt chunk')
    if (!foundData) inspection.breaches.push('missing data chunk')
    if (inspection.audioFormat !== 1) {
        inspection.breaches.push(
            `audioFormat ${inspection.audioFormat} != 1 (PCM)`,
        )
    }
    if (inspection.bitDepth !== 24) {
        inspection.breaches.push(`bitDepth ${inspection.bitDepth} != 24`)
    }
    if (inspection.channels !== 1 && inspection.channels !== 2) {
        inspection.breaches.push(
            `channels ${inspection.channels} is not mono/stereo`,
        )
    }
    if (inspection.blockAlign !== inspection.channels * 3) {
        inspection.breaches.push(
            `blockAlign ${inspection.blockAlign} != channels * 3`,
        )
    }
    inspection.valid = inspection.breaches.length === 0
    return inspection
}

const readSigned24LittleEndian = (buffer: Buffer, offset: number): number => {
    let value =
        buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
    if (value & 0x800000) value -= 0x1000000
    return value / 0x800000
}

const loopResult = (
    valid: boolean,
    stemId: string,
    firstSampleNormalized: number,
    lastSampleNormalized: number,
    zeroCrossingDelta: number,
    statusCode: LoopBoundaryAuditResult['statusCode'],
    message: string,
): LoopBoundaryAuditResult => ({
    valid,
    stemId,
    firstSampleNormalized,
    lastSampleNormalized,
    zeroCrossingDelta,
    vocalBandCeilingDbfs: Number.NEGATIVE_INFINITY,
    statusCode,
    message,
})

export const verifySeamlessLoopZeroCrossing = (
    wavBuffer: Buffer,
    maxDeltaThreshold = 0.02,
    stemId = '',
): LoopBoundaryAuditResult => {
    const inspection = inspectWavPcm(wavBuffer)
    if (!inspection.valid) {
        return loopResult(
            false,
            stemId,
            0,
            0,
            0,
            'MUSIC_WAV_MISSING_OR_CORRUPT_BREACH',
            `WAV PCM inspection failed: ${inspection.breaches.join('; ')}.`,
        )
    }
    if (inspection.dataBytes < 3) {
        return loopResult(
            false,
            stemId,
            0,
            0,
            0,
            'MUSIC_WAV_MISSING_OR_CORRUPT_BREACH',
            'WAV data chunk is too small for 24-bit loop boundary samples.',
        )
    }

    const firstOffset = inspection.dataOffset
    const lastOffset = inspection.dataOffset + inspection.dataBytes - 3
    const firstSampleNormalized = readSigned24LittleEndian(
        wavBuffer,
        firstOffset,
    )
    const lastSampleNormalized = readSigned24LittleEndian(wavBuffer, lastOffset)
    const zeroCrossingDelta = Math.max(
        Math.abs(firstSampleNormalized),
        Math.abs(lastSampleNormalized),
        Math.abs(firstSampleNormalized - lastSampleNormalized),
    )

    const breaches: string[] = []
    if (Math.abs(firstSampleNormalized) > maxDeltaThreshold) {
        breaches.push(
            `first sample ${firstSampleNormalized.toFixed(6)} exceeds +/-${maxDeltaThreshold}`,
        )
    }
    if (Math.abs(lastSampleNormalized) > maxDeltaThreshold) {
        breaches.push(
            `last sample ${lastSampleNormalized.toFixed(6)} exceeds +/-${maxDeltaThreshold}`,
        )
    }
    if (
        Math.abs(firstSampleNormalized - lastSampleNormalized) >
        maxDeltaThreshold
    ) {
        breaches.push(
            `loop delta ${Math.abs(firstSampleNormalized - lastSampleNormalized).toFixed(6)} exceeds +/-${maxDeltaThreshold}`,
        )
    }

    if (breaches.length > 0) {
        return loopResult(
            false,
            stemId,
            firstSampleNormalized,
            lastSampleNormalized,
            zeroCrossingDelta,
            'LOOP_BOUNDARY_CLICK_BREACH',
            `Seamless loop boundary breached: ${breaches.join('; ')}.`,
        )
    }

    return loopResult(
        true,
        stemId,
        firstSampleNormalized,
        lastSampleNormalized,
        zeroCrossingDelta,
        'MUSIC_STEM_COMPLIANT',
        `Loop boundary zero-crossing delta ${zeroCrossingDelta.toFixed(6)} within +/-${maxDeltaThreshold}.`,
    )
}

export const auditVocalBandEnergy = (
    stem: MusicStemDefinition,
    maxVocalBandCeilingDbfs = -14.0,
): LoopBoundaryAuditResult => {
    const ceiling = Number(stem?.vocal_band_ceiling_dbfs ?? 0)
    const ducking = Number(stem?.recommended_ducking_db ?? 0)
    const breaches: string[] = []

    if (!(ceiling <= maxVocalBandCeilingDbfs)) {
        breaches.push(
            `vocal_band_ceiling_dbfs ${ceiling} exceeds ceiling ${maxVocalBandCeilingDbfs}`,
        )
    }
    if (!(ducking <= -6.0)) {
        breaches.push(
            `recommended_ducking_db ${ducking} exceeds required <= -6.0 dB headroom`,
        )
    }

    if (breaches.length > 0) {
        return {
            valid: false,
            stemId: String(stem?.stem_id || ''),
            firstSampleNormalized: 0,
            lastSampleNormalized: 0,
            zeroCrossingDelta: 0,
            vocalBandCeilingDbfs: ceiling,
            statusCode: 'VOCAL_BAND_MASKING_BREACH',
            message: `Vocal-band masking risk: ${breaches.join('; ')}.`,
        }
    }

    return {
        valid: true,
        stemId: String(stem?.stem_id || ''),
        firstSampleNormalized: 0,
        lastSampleNormalized: 0,
        zeroCrossingDelta: 0,
        vocalBandCeilingDbfs: ceiling,
        statusCode: 'MUSIC_STEM_COMPLIANT',
        message: `Vocal-band ceiling ${ceiling} dBFS and ducking ${ducking} dB preserve dialogue headroom.`,
    }
}
