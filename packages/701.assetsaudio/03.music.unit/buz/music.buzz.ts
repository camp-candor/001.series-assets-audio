import { createHash } from 'crypto'
import fs from 'fs-extra'
import path from 'path'
import type { MusicModel } from '../music.model.js'
import type MusicBit from '../fce/music.bit.js'
import type {
    LoopBoundaryAuditResult,
    MusicManifest,
    MusicManifestValidationResult,
    MusicRegistrationPayload,
    MusicStemCategory,
    MusicStemDefinition,
    MusicStemResolutionResult,
} from '../fce/music.interface.js'
import {
    auditVocalBandEnergy,
    inspectWavPcm,
    verifySeamlessLoopZeroCrossing,
} from './spectralLinter.buzz.js'

const REQUIRED_SAMPLE_RATE_HZ = 48000
const REQUIRED_BIT_DEPTH = 24
const MUSIC_MIN_WAV_BYTES = 1024
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const DEFAULT_VOCAL_BAND_CEILING_DBFS = -18.0
const DEFAULT_RECOMMENDED_DUCKING_DB = -9.0

const MODULE_REPO_ROOT =
    typeof __dirname !== 'undefined'
        ? path.resolve(__dirname, '..', '..', '..', '..')
        : process.cwd()

const emitConsole = async (ste: any, src: string): Promise<void> => {
    if (!ste?.hunt) return
    await ste
        .hunt('[Console action] Update Console', { idx: 'cns00', src })
        .catch(() => {})
}

const musicRootOf = (cpy: MusicModel, bal?: MusicBit): string => {
    const dat: any = bal?.dat || {}
    return path.resolve(
        dat.musicRoot ||
            dat.repoRoot ||
            dat.root ||
            cpy?.musicRoot ||
            MODULE_REPO_ROOT,
    )
}

export const musicManifestPathOf = (repoRoot: string): string =>
    path.join(repoRoot, 'music', 'manifest.json')

export const normalizeMusicStemId = (raw: unknown): string => {
    let stem = String(raw ?? '').trim()
    stem = stem.replace(/^music:\/\//i, '')
    const parts = stem.split('/').filter((part) => part.length > 0)
    return (parts[parts.length - 1] || stem).trim().toLowerCase()
}

export const loadMusicManifest = async (
    repoRoot: string,
): Promise<MusicManifest> => {
    const manifestPath = musicManifestPathOf(repoRoot)
    if (!(await fs.pathExists(manifestPath))) {
        throw new Error(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: no music manifest at [${manifestPath}].`,
        )
    }
    const manifest = (await fs.readJson(manifestPath)) as MusicManifest
    if (
        !manifest ||
        typeof manifest !== 'object' ||
        manifest.schema_version !== '1.0.0' ||
        !manifest.stems ||
        typeof manifest.stems !== 'object'
    ) {
        throw new Error(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${manifestPath}] is not a valid music manifest.`,
        )
    }
    return manifest
}

const writeManifestAtomic = async (
    manifestPath: string,
    manifest: MusicManifest,
): Promise<void> => {
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const tmpPath = path.join(
        path.dirname(manifestPath),
        `.tmp_music_manifest_${nonce}.json`,
    )
    await fs.writeJson(tmpPath, manifest, { spaces: 4 })
    await fs.rename(tmpPath, manifestPath)
}

export const findMusicStem = (
    manifest: MusicManifest,
    rawStem: unknown,
): { stemId: string; stem: MusicStemDefinition } | null => {
    const stemId = normalizeMusicStemId(rawStem)
    if (!stemId) return null
    const direct = manifest.stems?.[stemId]
    if (direct) return { stemId, stem: direct }
    for (const [key, stem] of Object.entries(manifest.stems || {})) {
        if (normalizeMusicStemId(stem?.stem_id) === stemId) {
            return { stemId: key, stem }
        }
    }
    return null
}

export interface MusicWavInspection {
    valid: boolean
    filePath: string
    fileBytes: number
    sha256: string
    sampleRateHz: number
    bitDepth: number
    channels: number
    durationMs: number
    breaches: string[]
}

export const inspectMusicWav = (filePath: string): MusicWavInspection => {
    const breaches: string[] = []
    let buffer: Buffer
    try {
        buffer = fs.readFileSync(filePath)
    } catch {
        return {
            valid: false,
            filePath,
            fileBytes: 0,
            sha256: '',
            sampleRateHz: 0,
            bitDepth: 0,
            channels: 0,
            durationMs: 0,
            breaches: [`unreadable file [${filePath}]`],
        }
    }

    const fileBytes = buffer.length
    const sha256 = createHash('sha256').update(buffer).digest('hex')
    if (fileBytes <= MUSIC_MIN_WAV_BYTES) {
        breaches.push(
            `file is ${fileBytes} bytes, minimum ${MUSIC_MIN_WAV_BYTES} required`,
        )
    }

    const pcm = inspectWavPcm(buffer)
    breaches.push(...pcm.breaches)
    if (pcm.sampleRateHz !== REQUIRED_SAMPLE_RATE_HZ) {
        breaches.push(
            `sampleRate ${pcm.sampleRateHz} != ${REQUIRED_SAMPLE_RATE_HZ}`,
        )
    }
    if (pcm.bitDepth !== REQUIRED_BIT_DEPTH) {
        breaches.push(`bitDepth ${pcm.bitDepth} != ${REQUIRED_BIT_DEPTH}`)
    }

    const blockAlign = pcm.blockAlign || pcm.channels * 3
    const durationMs =
        pcm.sampleRateHz > 0 && blockAlign > 0
            ? Math.round(
                  (pcm.dataBytes / (pcm.sampleRateHz * blockAlign)) * 1000,
              )
            : 0

    return {
        valid: breaches.length === 0,
        filePath,
        fileBytes,
        sha256,
        sampleRateHz: pcm.sampleRateHz,
        bitDepth: pcm.bitDepth,
        channels: pcm.channels,
        durationMs,
        breaches,
    }
}

const resolveWavPath = (repoRoot: string, wavPath: string): string =>
    path.isAbsolute(wavPath) ? wavPath : path.join(repoRoot, wavPath)

interface StemAudit {
    valid: boolean
    stemId: string
    breaches: string[]
    wavPath: string
    boundary: LoopBoundaryAuditResult | null
    vocal: LoopBoundaryAuditResult | null
}

const auditMusicStem = (
    stem: MusicStemDefinition,
    repoRoot: string,
): StemAudit => {
    const stemId = String(stem?.stem_id || '')
    const breaches: string[] = []
    let boundary: LoopBoundaryAuditResult | null = null
    let vocal: LoopBoundaryAuditResult | null = null

    if (!stemId) {
        breaches.push('MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: stem_id is empty.')
    }
    if (stem?.category !== 'ambient' && stem?.category !== 'score') {
        breaches.push(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] category [${stem?.category}] is not ambient/score.`,
        )
    }
    if (!stem?.wav_path) {
        breaches.push(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] wav_path is empty.`,
        )
    }
    const declaredHash = String(stem?.sha256 || '').toLowerCase()
    if (!SHA256_PATTERN.test(declaredHash)) {
        breaches.push(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] sha256 is not a lowercase 64-char hex digest.`,
        )
    }
    if (stem?.sample_rate_hz !== REQUIRED_SAMPLE_RATE_HZ) {
        breaches.push(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] sample_rate_hz ${stem?.sample_rate_hz} != ${REQUIRED_SAMPLE_RATE_HZ}.`,
        )
    }
    if (stem?.bit_depth !== REQUIRED_BIT_DEPTH) {
        breaches.push(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] bit_depth ${stem?.bit_depth} != ${REQUIRED_BIT_DEPTH}.`,
        )
    }
    if (stem?.channels !== 1 && stem?.channels !== 2) {
        breaches.push(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] channels ${stem?.channels} is not mono/stereo.`,
        )
    }
    if (!(Number(stem?.duration_ms) > 0)) {
        breaches.push(
            `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] duration_ms must be positive.`,
        )
    }
    if (stem?.loop_seamless !== true) {
        breaches.push(
            `LOOP_BOUNDARY_CLICK_BREACH: [${stemId}] loop_seamless is not true.`,
        )
    }

    let buffer: Buffer | null = null
    let wavPath = ''
    if (stem?.wav_path) {
        wavPath = resolveWavPath(repoRoot, stem.wav_path)
        if (!fs.existsSync(wavPath)) {
            breaches.push(
                `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] missing physical WAV at [${stem.wav_path}].`,
            )
        } else {
            const stat = fs.statSync(wavPath)
            if (!stat.isFile() || stat.size <= MUSIC_MIN_WAV_BYTES) {
                breaches.push(
                    `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] WAV is ${stat.size} bytes, minimum ${MUSIC_MIN_WAV_BYTES} required.`,
                )
            } else {
                buffer = fs.readFileSync(wavPath)
                const actualHash = createHash('sha256')
                    .update(buffer)
                    .digest('hex')
                if (declaredHash && actualHash !== declaredHash) {
                    breaches.push(
                        `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] on-disk SHA-256 [${actualHash.slice(0, 12)}...] does not match manifest [${declaredHash.slice(0, 12)}...].`,
                    )
                }
            }
        }
    }

    if (buffer) {
        const inspection = inspectMusicWav(wavPath)
        if (!inspection.valid) {
            breaches.push(
                `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] ${inspection.breaches.join('; ')}.`,
            )
        }
        boundary = verifySeamlessLoopZeroCrossing(buffer, 0.02, stemId)
        if (!boundary.valid) {
            breaches.push(`${boundary.statusCode}: ${boundary.message}`)
        }
        const measuredDelta = Number(boundary.zeroCrossingDelta.toFixed(6))
        if (
            typeof stem?.zero_crossing_delta === 'number' &&
            Math.abs(stem.zero_crossing_delta - measuredDelta) > 0.000001
        ) {
            breaches.push(
                `LOOP_BOUNDARY_CLICK_BREACH: [${stemId}] declared zero_crossing_delta ${stem.zero_crossing_delta} does not match measured ${measuredDelta}.`,
            )
        }
    }

    vocal = auditVocalBandEnergy(stem)
    if (!vocal.valid) {
        breaches.push(`${vocal.statusCode}: ${vocal.message}`)
    }

    return {
        valid: breaches.length === 0,
        stemId,
        breaches,
        wavPath,
        boundary,
        vocal,
    }
}

export const initMusic = async (
    cpy: MusicModel,
    bal: MusicBit,
    ste?: any,
): Promise<MusicModel> => {
    await emitConsole(
        ste,
        '>> [MUSIC] Continuous Musical Bed & Ambient Sound Unit Initialized.',
    )
    if (bal?.slv) {
        bal.slv({
            musicBit: { idx: 'init-music', val: 0 },
        })
    }
    return cpy
}

export const validateMusicManifest = async (
    cpy: MusicModel,
    bal: MusicBit,
    ste?: any,
): Promise<MusicModel> => {
    const repoRoot = musicRootOf(cpy, bal)
    const manifest = await loadMusicManifest(repoRoot)
    const stems = Object.values(manifest.stems || {})
    const breaches: string[] = []
    const stemsValidated: string[] = []

    for (const stem of stems) {
        const audit = auditMusicStem(stem, repoRoot)
        if (audit.valid) {
            stemsValidated.push(audit.stemId)
        } else {
            breaches.push(...audit.breaches)
        }
    }

    const validation: MusicManifestValidationResult = {
        valid: breaches.length === 0,
        manifestPath: musicManifestPathOf(repoRoot),
        stemsValidated,
        totalStems: stems.length,
        breaches,
    }

    if (validation.valid) {
        cpy.stemsRegistered = stems.length
        cpy.stemsVerified = stemsValidated.length
        cpy.lastResolutionStatus = 'MUSIC_STEM_COMPLIANT'
        await emitConsole(
            ste,
            `>> [MUSIC:MANIFEST:OK] Verified ${stemsValidated.length} stems (ambient/score loop and vocal-band clearances)`,
        )
    } else {
        cpy.lastResolutionStatus =
            breaches[0]?.split(':')[0] || 'MUSIC_WAV_MISSING_OR_CORRUPT_BREACH'
        await emitConsole(
            ste,
            `>> [MUSIC:MANIFEST:HALT] ${breaches[0] || 'MUSIC_WAV_MISSING_OR_CORRUPT_BREACH'}`,
        )
    }

    if (bal?.slv) {
        bal.slv({
            musicBit: {
                idx: 'validate-music-manifest',
                val: validation.valid ? 0 : -1,
                dat: validation,
                src: validation.manifestPath,
            },
        })
    }

    if (!validation.valid) {
        throw new Error(breaches.join(' | '))
    }
    return cpy
}

export const verifyLoopBoundaries = async (
    cpy: MusicModel,
    bal: MusicBit,
    ste?: any,
): Promise<MusicModel> => {
    const repoRoot = musicRootOf(cpy, bal)
    const dat: any = bal?.dat || {}
    const rawTarget = dat.stemId ?? dat.stem ?? dat.cue ?? dat.src ?? bal?.src
    const manifest = await loadMusicManifest(repoRoot)
    const target = rawTarget ? findMusicStem(manifest, rawTarget) : null

    if (rawTarget && !target) {
        const stemId = normalizeMusicStemId(rawTarget)
        const resolution: MusicStemResolutionResult = {
            valid: false,
            stemId,
            stem: null,
            statusCode: 'MUSIC_STEM_UNREGISTERED_BREACH',
            message: `Music stem [${stemId || String(rawTarget)}] is not registered in music/manifest.json.`,
        }
        await emitConsole(
            ste,
            `>> [MUSIC:HALT] ${resolution.statusCode}: ${resolution.message}`,
        )
        if (bal?.slv) {
            bal.slv({
                musicBit: {
                    idx: 'verify-loop-boundaries',
                    val: -1,
                    dat: resolution,
                    src: resolution.statusCode,
                },
            })
        }
        throw new Error(`${resolution.statusCode}: ${resolution.message}`)
    }

    const entries = target
        ? [target]
        : Object.entries(manifest.stems || {}).map(([key, stem]) => ({
              stemId: key,
              stem,
          }))
    const breaches: string[] = []
    const stemsChecked: string[] = []

    for (const entry of entries) {
        const audit = auditMusicStem(entry.stem, repoRoot)
        if (audit.valid) {
            stemsChecked.push(entry.stemId)
        } else {
            breaches.push(...audit.breaches)
        }
    }

    const valid = breaches.length === 0
    if (valid) {
        cpy.stemsVerified = stemsChecked.length
        cpy.lastResolutionStatus = 'MUSIC_STEM_COMPLIANT'
        await emitConsole(
            ste,
            target
                ? `>> [MUSIC:LOOP:OK] Verified loop boundary and vocal band for ${target.stemId}`
                : `>> [MUSIC:LOOP:OK] Verified ${stemsChecked.length} music stems`,
        )
    } else {
        cpy.lastResolutionStatus =
            breaches[0]?.split(':')[0] || 'LOOP_BOUNDARY_CLICK_BREACH'
        await emitConsole(ste, `>> [MUSIC:LOOP:HALT] ${breaches[0]}`)
    }

    if (bal?.slv) {
        bal.slv({
            musicBit: {
                idx: 'verify-loop-boundaries',
                val: valid ? 0 : -1,
                dat: {
                    valid,
                    stemsChecked,
                    totalStems: entries.length,
                    breaches,
                },
                src: target?.stemId,
            },
        })
    }

    if (!valid) {
        throw new Error(breaches.join(' | '))
    }
    return cpy
}

export const resolveMusicStem = async (
    cpy: MusicModel,
    bal: MusicBit,
    ste?: any,
): Promise<MusicModel> => {
    const repoRoot = musicRootOf(cpy, bal)
    const dat: any = bal?.dat || {}
    const rawStem = dat.stemId ?? dat.stem ?? dat.uri ?? dat.src ?? bal?.src
    const stemId = normalizeMusicStemId(rawStem)
    const manifest = await loadMusicManifest(repoRoot)
    const found = findMusicStem(manifest, rawStem)

    let resolution: MusicStemResolutionResult
    if (!found) {
        resolution = {
            valid: false,
            stemId,
            stem: null,
            statusCode: 'MUSIC_STEM_UNREGISTERED_BREACH',
            message: `Music stem [${stemId || String(rawStem)}] is not registered in music/manifest.json.`,
        }
    } else {
        const audit = auditMusicStem(found.stem, repoRoot)
        if (audit.valid) {
            resolution = {
                valid: true,
                stemId: found.stemId,
                stem: found.stem,
                statusCode: 'MUSIC_STEM_COMPLIANT',
                message: `Music stem [${found.stemId}] resolved to [${found.stem.wav_path}].`,
            }
        } else {
            const code = (audit.breaches[0]?.split(':')[0] ||
                'MUSIC_WAV_MISSING_OR_CORRUPT_BREACH') as MusicStemResolutionResult['statusCode']
            resolution = {
                valid: false,
                stemId: found.stemId,
                stem: found.stem,
                statusCode: code,
                message: audit.breaches.join(' | '),
            }
        }
    }

    cpy.lastResolutionStatus = resolution.statusCode
    if (resolution.valid) {
        cpy.lastRegisteredStem = resolution.stemId
        await emitConsole(
            ste,
            `>> [MUSIC:RESOLVE] ${resolution.stemId} -> ${resolution.stem?.wav_path}`,
        )
    } else {
        await emitConsole(
            ste,
            `>> [MUSIC:HALT] ${resolution.statusCode}: ${resolution.message}`,
        )
    }

    if (bal?.slv) {
        bal.slv({
            musicBit: {
                idx: 'resolve-music-stem',
                val: resolution.valid ? 0 : -1,
                dat: resolution,
                src: resolution.statusCode,
            },
        })
    }

    if (!resolution.valid) {
        throw new Error(`${resolution.statusCode}: ${resolution.message}`)
    }
    return cpy
}

const inferMusicCategory = (
    wavPath: string,
    explicit?: MusicStemCategory,
): MusicStemCategory | null => {
    if (explicit === 'ambient' || explicit === 'score') return explicit
    const normalized = wavPath.replace(/\\/g, '/').toLowerCase()
    if (
        normalized.includes('/ambient/') ||
        normalized.includes('music/ambient')
    ) {
        return 'ambient'
    }
    if (normalized.includes('/score/') || normalized.includes('music/score')) {
        return 'score'
    }
    return null
}

export const registerMusicStem = async (
    cpy: MusicModel,
    bal: MusicBit,
    ste?: any,
): Promise<MusicModel> => {
    const repoRoot = musicRootOf(cpy, bal)
    const dat: MusicRegistrationPayload & Record<string, any> =
        (bal?.dat as any) || {}
    const stemId = normalizeMusicStemId(
        dat.stemId ?? dat.stem ?? dat.stem_id ?? dat.src,
    )
    const wavPathInput = String(dat.wavPath ?? dat.wav_path ?? dat.file ?? '')
    if (!stemId || !wavPathInput) {
        throw new Error(
            'MUSIC_REGISTER_PAYLOAD_BREACH: registerMusicStem requires dat.stemId and dat.wavPath.',
        )
    }

    const absoluteWavPath = path.isAbsolute(wavPathInput)
        ? wavPathInput
        : path.resolve(repoRoot, wavPathInput)
    if (!(await fs.pathExists(absoluteWavPath))) {
        const message = `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] missing candidate WAV at [${wavPathInput}].`
        await emitConsole(ste, `>> [MUSIC:REGISTER:HALT] ${message}`)
        if (bal?.slv) {
            bal.slv({
                musicBit: {
                    idx: 'register-music-stem',
                    val: -1,
                    dat: { valid: false, breaches: [message] },
                    src: 'MUSIC_WAV_MISSING_OR_CORRUPT_BREACH',
                },
            })
        }
        throw new Error(message)
    }

    const buffer = await fs.readFile(absoluteWavPath)
    const inspection = inspectMusicWav(absoluteWavPath)
    if (!inspection.valid) {
        const message = `MUSIC_WAV_MISSING_OR_CORRUPT_BREACH: [${stemId}] ${inspection.breaches.join('; ')}.`
        await emitConsole(ste, `>> [MUSIC:REGISTER:HALT] ${message}`)
        if (bal?.slv) {
            bal.slv({
                musicBit: {
                    idx: 'register-music-stem',
                    val: -1,
                    dat: { valid: false, breaches: inspection.breaches },
                    src: 'MUSIC_WAV_MISSING_OR_CORRUPT_BREACH',
                },
            })
        }
        throw new Error(message)
    }

    const boundary = verifySeamlessLoopZeroCrossing(buffer, 0.02, stemId)
    if (!boundary.valid) {
        const message = `${boundary.statusCode}: ${boundary.message}`
        await emitConsole(ste, `>> [MUSIC:REGISTER:HALT] ${message}`)
        if (bal?.slv) {
            bal.slv({
                musicBit: {
                    idx: 'register-music-stem',
                    val: -1,
                    dat: boundary,
                    src: boundary.statusCode,
                },
            })
        }
        throw new Error(message)
    }

    const category = inferMusicCategory(absoluteWavPath, dat.category)
    if (!category) {
        throw new Error(
            `MUSIC_REGISTER_PAYLOAD_BREACH: [${stemId}] category must be ambient or score, or wavPath must contain music/ambient or music/score.`,
        )
    }

    const stem: MusicStemDefinition = {
        stem_id: stemId,
        category,
        wav_path: path
            .relative(repoRoot, absoluteWavPath)
            .split(path.sep)
            .join('/'),
        sha256: inspection.sha256,
        sample_rate_hz: REQUIRED_SAMPLE_RATE_HZ as 48000,
        bit_depth: REQUIRED_BIT_DEPTH as 24,
        channels: inspection.channels === 2 ? 2 : 1,
        duration_ms: inspection.durationMs,
        loop_seamless: true,
        zero_crossing_delta: Number(boundary.zeroCrossingDelta.toFixed(6)),
        vocal_band_ceiling_dbfs: Number(
            dat.vocalBandCeilingDbfs ??
                dat.vocal_band_ceiling_dbfs ??
                DEFAULT_VOCAL_BAND_CEILING_DBFS,
        ),
        recommended_ducking_db: Number(
            dat.recommendedDuckingDb ??
                dat.recommended_ducking_db ??
                DEFAULT_RECOMMENDED_DUCKING_DB,
        ),
        description: String(
            dat.description || `Music ${category} stem [${stemId}]`,
        ),
    }

    const vocal = auditVocalBandEnergy(stem)
    if (!vocal.valid) {
        const message = `${vocal.statusCode}: ${vocal.message}`
        await emitConsole(ste, `>> [MUSIC:REGISTER:HALT] ${message}`)
        if (bal?.slv) {
            bal.slv({
                musicBit: {
                    idx: 'register-music-stem',
                    val: -1,
                    dat: vocal,
                    src: vocal.statusCode,
                },
            })
        }
        throw new Error(message)
    }

    const manifestPath = musicManifestPathOf(repoRoot)
    let manifest: MusicManifest
    if (await fs.pathExists(manifestPath)) {
        manifest = await loadMusicManifest(repoRoot)
    } else {
        manifest = {
            schema_version: '1.0.0',
            series_scope: String(
                dat.seriesScope ?? dat.series_scope ?? 'the_parallax_dinner',
            ),
            stems: {},
        }
    }
    manifest.stems[stemId] = stem
    await writeManifestAtomic(manifestPath, manifest)

    cpy.stemsRegistered = Object.keys(manifest.stems).length
    cpy.lastRegisteredStem = stemId
    cpy.lastResolutionStatus = 'MUSIC_STEM_COMPLIANT'
    await emitConsole(ste, `>> [MUSIC:REGISTER] ${stemId} (${stem.wav_path})`)
    if (bal?.slv) {
        bal.slv({
            musicBit: {
                idx: 'register-music-stem',
                val: 1,
                dat: { stem, stemCount: cpy.stemsRegistered },
                src: stem.wav_path,
            },
        })
    }
    return cpy
}

export const updateMusic = async (
    cpy: MusicModel,
    bal: MusicBit,
    ste?: any,
): Promise<MusicModel> => {
    const dat: any = bal?.dat || {}
    if (typeof dat.stemsRegistered === 'number')
        cpy.stemsRegistered = dat.stemsRegistered
    if (typeof dat.stemsVerified === 'number')
        cpy.stemsVerified = dat.stemsVerified
    if (typeof dat.lastResolutionStatus === 'string')
        cpy.lastResolutionStatus = dat.lastResolutionStatus
    if (typeof dat.lastRegisteredStem === 'string')
        cpy.lastRegisteredStem = dat.lastRegisteredStem
    if (bal?.slv) {
        bal.slv({
            musicBit: {
                idx: 'update-music',
                val: 0,
                dat: {
                    stemsRegistered: cpy.stemsRegistered,
                    stemsVerified: cpy.stemsVerified,
                    lastResolutionStatus: cpy.lastResolutionStatus,
                    lastRegisteredStem: cpy.lastRegisteredStem,
                },
            },
        })
    }
    return cpy
}
