import fs from 'fs-extra'
import path from 'path'
import { createHash } from 'crypto'
import type { VoiceModel } from '../voice.model.js'
import type VoiceBit from '../fce/voice.bit.js'
import type Voice from '../fce/voice.interface.js'
import type {
    ActivePointerCheck,
    CharacterVoiceResolution,
    LexiconValidationResult,
    OrphanTakeAuditResult,
    SymlinkIntegrityReport,
    VoiceManifestValidationResult,
    VoiceTakeRegistrationPayload,
    WavHeaderInfo,
} from '../fce/voice.interface.js'
import type { LexiconManifest } from '../fce/legalClearance.interface.js'
import { evaluateLegalClearance } from './legalTokenValidate.buzz.js'
import { retargetActiveSymlink } from './symlinkRetarget.buzz.js'
import { generateSpeakerEmbedding } from './embeddingExtract.buzz.js'

export { initVoice } from './vaultScaffold.buzz.js'

export const REQUIRED_SAMPLE_RATE_HZ = 48000
export const REQUIRED_BIT_DEPTH = 24
export const REQUIRED_CHANNELS = 1
export const MIN_REFERENCE_WAV_BYTES = 1024
export const REQUIRED_LEXICON_TERMS = [
    'Mayhaw',
    'Okefenokee',
    'astigmatism',
    'Phoropter',
]

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SLUG_PATTERN = /^[a-z0-9_]+$/
const ASCII_PRINTABLE_PATTERN = /^[\x20-\x7E]+$/
const ARPABET_PATTERN = /^[A-Z]{1,2}[012]?( [A-Z]{1,2}[012]?)*$/
const POINTER_FILE_MAX_BYTES = 512

const emitConsole = async (ste: any, src: string): Promise<void> => {
    if (!ste?.hunt) return
    await ste
        .hunt('[Console action] Update Console', { idx: 'cns00', src })
        .catch(() => {})
}

const fail = async (
    bal: VoiceBit,
    ste: any,
    idx: string,
    errorMsg: string,
): Promise<never> => {
    await emitConsole(ste, `:: [VOICE:ERR] ${errorMsg}`)
    if (bal?.slv) bal.slv({ voiBit: { idx: `${idx}-fail`, val: -1 } })
    throw new Error(errorMsg)
}

const canonicalize = (value: any): any => {
    if (Array.isArray(value)) return value.map(canonicalize)
    if (value && typeof value === 'object') {
        const sorted: Record<string, any> = {}
        for (const k of Object.keys(value).sort()) {
            sorted[k] = canonicalize(value[k])
        }
        return sorted
    }
    return value
}

const vaultRootOf = (cpy: VoiceModel, bal?: VoiceBit): string => {
    const dat: any = bal?.dat || {}
    return path.resolve(dat.vaultRoot || cpy?.voicesRoot || process.cwd())
}

const toPosix = (p: string): string => p.split(path.sep).join('/')

const readJsonSafe = async (filePath: string): Promise<any> => {
    if (!(await fs.pathExists(filePath))) return null
    try {
        return await fs.readJson(filePath)
    } catch {
        return null
    }
}

const writeManifestAtomic = async (
    manifestPath: string,
    manifest: Record<string, any>,
): Promise<void> => {
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const tmpPath = path.join(
        path.dirname(manifestPath),
        `.tmp_voice_manifest_${nonce}.json`,
    )
    await fs.writeJson(tmpPath, canonicalize(manifest), { spaces: 4 })
    await fs.rename(tmpPath, manifestPath)
}

export const sha256File = async (filePath: string): Promise<string> =>
    createHash('sha256')
        .update(await fs.readFile(filePath))
        .digest('hex')

export const parseWavHeader = (buf: Buffer): WavHeaderInfo => {
    const info: WavHeaderInfo = {
        isRiffWave: false,
        audioFormat: 0,
        channels: 0,
        sampleRateHz: 0,
        bitDepth: 0,
        dataBytes: 0,
        fileBytes: buf?.length || 0,
    }
    if (!buf || buf.length < 12) return info
    if (
        buf.toString('ascii', 0, 4) !== 'RIFF' ||
        buf.toString('ascii', 8, 12) !== 'WAVE'
    ) {
        return info
    }
    info.isRiffWave = true
    let offset = 12
    while (offset + 8 <= buf.length) {
        const chunkId = buf.toString('ascii', offset, offset + 4)
        const chunkSize = buf.readUInt32LE(offset + 4)
        const body = offset + 8
        if (chunkId === 'fmt ' && body + 16 <= buf.length) {
            info.audioFormat = buf.readUInt16LE(body)
            info.channels = buf.readUInt16LE(body + 2)
            info.sampleRateHz = buf.readUInt32LE(body + 4)
            info.bitDepth = buf.readUInt16LE(body + 14)
        } else if (chunkId === 'data') {
            info.dataBytes = Math.min(chunkSize, buf.length - body)
        }
        offset = body + chunkSize + (chunkSize % 2)
    }
    return info
}

export const isCanonicalReferenceWav = (info: WavHeaderInfo): boolean =>
    info.isRiffWave &&
    (info.audioFormat === 1 || info.audioFormat === 0xfffe) &&
    info.sampleRateHz === REQUIRED_SAMPLE_RATE_HZ &&
    info.bitDepth === REQUIRED_BIT_DEPTH &&
    info.channels === REQUIRED_CHANNELS &&
    info.dataBytes > 0 &&
    info.fileBytes > MIN_REFERENCE_WAV_BYTES

export interface ReferenceToneSpec {
    fundamentalHz: number
    durationSec: number
    cadenceHz?: number
    harmonics?: number[]
}

export const encodeReferenceWav = (spec: ReferenceToneSpec): Buffer => {
    const sampleRate = REQUIRED_SAMPLE_RATE_HZ
    const bytesPerSample = REQUIRED_BIT_DEPTH / 8
    const totalSamples = Math.max(1, Math.round(spec.durationSec * sampleRate))
    const harmonics = spec.harmonics || [1, 0.5, 0.25, 0.125]
    const cadenceHz = spec.cadenceHz ?? 3
    const norm = harmonics.reduce((a, b) => a + Math.abs(b), 0) || 1
    const dataBytes = totalSamples * bytesPerSample
    const buf = Buffer.alloc(44 + dataBytes)

    buf.write('RIFF', 0, 'ascii')
    buf.writeUInt32LE(36 + dataBytes, 4)
    buf.write('WAVE', 8, 'ascii')
    buf.write('fmt ', 12, 'ascii')
    buf.writeUInt32LE(16, 16)
    buf.writeUInt16LE(1, 20)
    buf.writeUInt16LE(REQUIRED_CHANNELS, 22)
    buf.writeUInt32LE(sampleRate, 24)
    buf.writeUInt32LE(sampleRate * bytesPerSample * REQUIRED_CHANNELS, 28)
    buf.writeUInt16LE(bytesPerSample * REQUIRED_CHANNELS, 32)
    buf.writeUInt16LE(REQUIRED_BIT_DEPTH, 34)
    buf.write('data', 36, 'ascii')
    buf.writeUInt32LE(dataBytes, 40)

    const maxAmp = 0x7fffff * 0.5
    for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate
        let s = 0
        for (let h = 0; h < harmonics.length; h++) {
            s +=
                harmonics[h] *
                Math.sin(2 * Math.PI * spec.fundamentalHz * (h + 1) * t)
        }
        const envelope = 0.55 + 0.45 * Math.sin(2 * Math.PI * cadenceHz * t)
        const fade = Math.min(1, t / 0.01, (spec.durationSec - t) / 0.01)
        const value = Math.round(
            (s / norm) * envelope * Math.max(0, fade) * maxAmp,
        )
        buf.writeIntLE(value, 44 + i * bytesPerSample, bytesPerSample)
    }
    return buf
}

const versionNumberOf = (tag: string): number =>
    parseInt(String(tag || '').replace(/^v/, ''), 10) || 0

const baseTakeRelPath = (slug: string, entry: any): string =>
    entry?.reference_wav_path ||
    `voices/versions/${slug}_${entry?.active_version || 'v1'}.wav`

export const inspectVoiceManifest = async (
    vaultRoot: string,
    opts: { requireAllCleared?: boolean } = {},
): Promise<VoiceManifestValidationResult> => {
    const manifestPath = path.join(vaultRoot, 'voices', 'voice_manifest.json')
    const result: VoiceManifestValidationResult = {
        valid: true,
        manifestPath,
        charactersValidated: [],
        rosterPending: [],
        breaches: [],
    }
    const manifest = await readJsonSafe(manifestPath)
    if (
        !manifest ||
        typeof manifest.voices !== 'object' ||
        Array.isArray(manifest.voices)
    ) {
        result.valid = false
        result.breaches.push(
            `VOICE_MANIFEST_SCHEMA_BREACH: ${toPosix(path.relative(vaultRoot, manifestPath))} missing or lacks a voices map.`,
        )
        return result
    }

    for (const slug of Object.keys(manifest.voices).sort()) {
        const entry = manifest.voices[slug] || {}
        const before = result.breaches.length
        if (!SLUG_PATTERN.test(slug)) {
            result.breaches.push(`VOICE_SLUG_FORMAT_BREACH: [${slug}]`)
        }
        if (!entry.reference_wav_path) {
            if (opts.requireAllCleared) {
                result.breaches.push(
                    `LEGAL_CLEARANCE_MISSING_BREACH: [${slug}] has no cleared reference take.`,
                )
            } else {
                result.rosterPending.push(slug)
            }
            continue
        }

        const clearance = evaluateLegalClearance({
            characterSlug: slug,
            clearanceToken: entry.legal_clearance_token,
            talentIdentifier: entry.talent_identifier,
            consentVerified: entry.consent_verified,
            signedAtIso: entry.signed_at,
            jurisdiction: entry.jurisdiction,
            sha256ConsentDigest: entry.consent_digest,
        })
        if (!clearance.valid) {
            result.breaches.push(
                `${clearance.statusCode}: ${clearance.message}`,
            )
        }
        if (!SHA256_PATTERN.test(String(entry.sha256 || ''))) {
            result.breaches.push(`VOICE_SHA256_FORMAT_BREACH: [${slug}]`)
        }

        const wavPath = path.resolve(vaultRoot, entry.reference_wav_path)
        if (!(await fs.pathExists(wavPath))) {
            result.breaches.push(
                `VOICE_REFERENCE_MISSING_BREACH: [${slug}] ${entry.reference_wav_path}`,
            )
        } else {
            const buf = await fs.readFile(wavPath)
            if (buf.length <= MIN_REFERENCE_WAV_BYTES) {
                result.breaches.push(
                    `VOICE_REFERENCE_UNDERSIZED_BREACH: [${slug}] ${buf.length} bytes`,
                )
            }
            const digest = createHash('sha256').update(buf).digest('hex')
            if (
                SHA256_PATTERN.test(String(entry.sha256 || '')) &&
                digest !== entry.sha256
            ) {
                result.breaches.push(
                    `VOICE_SHA256_MISMATCH_BREACH: [${slug}] manifest ${entry.sha256} != disk ${digest}`,
                )
            }
        }

        if (result.breaches.length === before) {
            result.charactersValidated.push(slug)
        }
    }

    result.valid = result.breaches.length === 0
    return result
}

export const validateVoiceManifest = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const dat: any = bal?.dat || {}
    const vaultRoot = vaultRootOf(cpy, bal)
    const result = await inspectVoiceManifest(vaultRoot, {
        requireAllCleared: dat.requireAllCleared === true,
    })

    for (const slug of result.charactersValidated) {
        await emitConsole(
            ste,
            `>> [MANIFEST:OK] [${slug}] clearance, digest and reference take verified.`,
        )
    }
    for (const slug of result.rosterPending) {
        await emitConsole(
            ste,
            `:: [MANIFEST:WARN] [${slug}] roster entry pending legal clearance.`,
        )
    }
    for (const breach of result.breaches) {
        await emitConsole(ste, `:: [MANIFEST:ERR] ${breach}`)
    }
    await emitConsole(
        ste,
        `>> [MANIFEST] Voice manifest ${result.valid ? '[VALID]' : '[INVALID]'} (${result.charactersValidated.length} cleared, ${result.rosterPending.length} pending).`,
    )

    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'validate-voice-manifest',
                val: result.valid ? 0 : 1,
                dat: result as any,
            },
        })
    }
    if (dat.strict === true && !result.valid) {
        throw new Error(
            `VOICE_MANIFEST_INVALID_BREACH: ${result.breaches.join(' | ')}`,
        )
    }
    return cpy
}

export const resolveCharacterVoice = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const dat: any = bal?.dat || {}
    const characterId = String(dat.characterId || bal?.src || '')
        .trim()
        .toLowerCase()
    const condition = String(dat.condition || 'neutral')
        .trim()
        .toLowerCase()
    const vaultRoot = vaultRootOf(cpy, bal)
    const manifest = await readJsonSafe(
        path.join(vaultRoot, 'voices', 'voice_manifest.json'),
    )
    const entry = manifest?.voices?.[characterId]
    if (!characterId || !entry) {
        return fail(
            bal,
            ste,
            'resolve-character-voice',
            `VOICE_CHARACTER_UNREGISTERED_BREACH: Character [${characterId}] is not registered in voice_manifest.json.`,
        )
    }

    const versionTag = String(entry.active_version || 'v1')
    let relPath = baseTakeRelPath(characterId, entry)
    let pointerName = `${characterId}.wav`
    let embeddingRel =
        entry.embedding_path ||
        `voices/embeddings/${characterId}_${versionTag}.pt`
    let sha256 = String(entry.sha256 || '')

    if (condition !== 'neutral') {
        const cond = entry.conditions?.[condition]
        const variant = entry.condition_variants?.[condition]
        if (cond?.reference_wav_path) {
            relPath = cond.reference_wav_path
            sha256 = String(cond.sha256 || sha256)
            if (cond.embedding_path) embeddingRel = cond.embedding_path
        } else if (variant) {
            const ver = String(variant.active_version || 'v1')
            relPath = `voices/versions/${characterId}_${condition}_${ver}.wav`
            pointerName = `${characterId}--${condition}.wav`
            embeddingRel = `voices/embeddings/${characterId}_${condition}_${ver}.pt`
            sha256 = String(variant.sha256 || '')
        } else {
            return fail(
                bal,
                ste,
                'resolve-character-voice',
                `VOICE_CONDITION_UNREGISTERED_BREACH: Condition [${condition}] is not registered for [${characterId}].`,
            )
        }
    }

    const referenceWavPath = path.resolve(vaultRoot, relPath)
    const embeddingPath = path.resolve(vaultRoot, embeddingRel)
    const resolution: CharacterVoiceResolution = {
        characterId,
        condition,
        versionTag,
        referenceWavPath,
        referenceWavRelPath: toPosix(relPath),
        activePointerPath: path.join(
            vaultRoot,
            'voices',
            'active',
            pointerName,
        ),
        embeddingPath,
        sha256,
        referenceExists: await fs.pathExists(referenceWavPath),
        embeddingExists: await fs.pathExists(embeddingPath),
    }

    await emitConsole(
        ste,
        `>> [VOICE:RESOLVE] [${characterId}:${condition}] -> ${resolution.referenceWavRelPath} (${versionTag})`,
    )
    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'resolve-character-voice',
                val: versionNumberOf(versionTag),
                dat: resolution as any,
                src: characterId,
            },
        })
    }
    return cpy
}

export const lookupLexiconEntry = (lexicon: LexiconManifest, word: string) => {
    const entries = lexicon?.entries || {}
    if (entries[word]) return entries[word]
    const key = Object.keys(entries).find(
        (k) => k.toLowerCase() === String(word || '').toLowerCase(),
    )
    return key ? entries[key] : undefined
}

export const inspectLexicon = async (
    vaultRoot: string,
    requiredTerms: string[] = REQUIRED_LEXICON_TERMS,
): Promise<LexiconValidationResult> => {
    const lexiconPath = path.join(vaultRoot, 'voices', 'lexicon.json')
    const result: LexiconValidationResult = {
        valid: true,
        lexiconPath,
        entryCount: 0,
        missingTerms: [],
        breaches: [],
    }
    const lexicon: LexiconManifest | null = await readJsonSafe(lexiconPath)
    if (!lexicon || typeof lexicon.entries !== 'object' || !lexicon.entries) {
        result.valid = false
        result.breaches.push(
            'LEXICON_SCHEMA_BREACH: lexicon.json missing or lacks an entries map.',
        )
        return result
    }
    const keys = Object.keys(lexicon.entries)
    result.entryCount = keys.length
    for (const key of keys) {
        const e: any = lexicon.entries[key] || {}
        if (!ASCII_PRINTABLE_PATTERN.test(key) || key !== key.trim()) {
            result.breaches.push(`LEXICON_KEY_ASCII_BREACH: [${key}]`)
        }
        if (typeof e.word !== 'string' || !e.word.trim()) {
            result.breaches.push(`LEXICON_WORD_EMPTY_BREACH: [${key}]`)
        }
        if (typeof e.arpabet !== 'string' || !ARPABET_PATTERN.test(e.arpabet)) {
            result.breaches.push(`LEXICON_ARPABET_BREACH: [${key}]`)
        }
        if (typeof e.ipa !== 'string' || !ASCII_PRINTABLE_PATTERN.test(e.ipa)) {
            result.breaches.push(`LEXICON_IPA_BREACH: [${key}]`)
        }
    }
    for (const term of requiredTerms) {
        if (!lookupLexiconEntry(lexicon, term)) result.missingTerms.push(term)
    }
    for (const term of result.missingTerms) {
        result.breaches.push(`LEXICON_REQUIRED_TERM_MISSING_BREACH: [${term}]`)
    }
    result.valid = result.breaches.length === 0
    return result
}

export const validateLexicon = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const dat: any = bal?.dat || {}
    const vaultRoot = vaultRootOf(cpy, bal)
    const result = await inspectLexicon(
        vaultRoot,
        Array.isArray(dat.requiredTerms)
            ? dat.requiredTerms
            : REQUIRED_LEXICON_TERMS,
    )
    for (const breach of result.breaches) {
        await emitConsole(ste, `:: [LEXICON:ERR] ${breach}`)
    }
    await emitConsole(
        ste,
        `>> [LEXICON] ${result.entryCount} phonetic override(s) ${result.valid ? '[VALID]' : '[INVALID]'}.`,
    )
    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'validate-lexicon',
                val: result.valid ? 0 : 1,
                dat: result as any,
            },
        })
    }
    if (dat.strict === true && !result.valid) {
        throw new Error(
            `LEXICON_INVALID_BREACH: ${result.breaches.join(' | ')}`,
        )
    }
    return cpy
}

const resolveActivePointer = async (
    pointerPath: string,
): Promise<{ kind: ActivePointerCheck['kind']; target: string }> => {
    let lst: fs.Stats
    try {
        lst = await fs.lstat(pointerPath)
    } catch {
        return { kind: 'missing', target: '' }
    }
    if (lst.isSymbolicLink()) {
        const raw = await fs.readlink(pointerPath)
        return {
            kind: 'symlink',
            target: path.resolve(path.dirname(pointerPath), raw),
        }
    }
    if (lst.isFile() && lst.size <= POINTER_FILE_MAX_BYTES) {
        const text = (await fs.readFile(pointerPath, 'utf8')).trim()
        if (/^[\x20-\x7E]+\.wav$/.test(text) && !text.startsWith('RIFF')) {
            return {
                kind: 'pointer-file',
                target: path.resolve(path.dirname(pointerPath), text),
            }
        }
    }
    return { kind: 'copy', target: pointerPath }
}

const isNonEmptyFile = async (p: string): Promise<boolean> => {
    try {
        const st = await fs.stat(p)
        return st.isFile() && st.size > 0
    } catch {
        return false
    }
}

export const inspectSymlinkIntegrity = async (
    vaultRoot: string,
): Promise<SymlinkIntegrityReport> => {
    const voicesBase = path.join(vaultRoot, 'voices')
    const activeDir = path.join(voicesBase, 'active')
    const versionsDir = path.join(voicesBase, 'versions')
    const manifest = await readJsonSafe(
        path.join(voicesBase, 'voice_manifest.json'),
    )
    const voices = manifest?.voices || {}
    const expectations = new Map<
        string,
        { expected: string; required: boolean }
    >()

    for (const slug of Object.keys(voices)) {
        const entry = voices[slug] || {}
        const ver = String(entry.active_version || 'v1')
        expectations.set(`${slug}.wav`, {
            expected: path.join(versionsDir, `${slug}_${ver}.wav`),
            required: Boolean(entry.reference_wav_path),
        })
        for (const [tag, meta] of Object.entries<any>(
            entry.condition_variants || {},
        )) {
            expectations.set(`${slug}--${tag}.wav`, {
                expected: path.join(
                    versionsDir,
                    `${slug}_${tag}_${String(meta?.active_version || 'v1')}.wav`,
                ),
                required: false,
            })
        }
    }

    const present = (await fs.pathExists(activeDir))
        ? (await fs.readdir(activeDir)).filter(
              (f) => f.endsWith('.wav') && !f.startsWith('.'),
          )
        : []
    const names = new Set<string>(present)
    for (const [name, exp] of expectations) {
        if (exp.required) names.add(name)
    }

    const report: SymlinkIntegrityReport = {
        intact: true,
        checked: [],
        dangling: [],
        mismatched: [],
    }

    for (const name of [...names].sort()) {
        const pointerPath = path.join(activeDir, name)
        const exp = expectations.get(name)
        const { kind, target } = await resolveActivePointer(pointerPath)
        const check: ActivePointerCheck = {
            pointerName: name,
            pointerPath,
            kind,
            resolvedTarget: target,
            expectedTarget: exp?.expected || '',
            ok: true,
        }

        if (kind === 'missing' || !(await isNonEmptyFile(target))) {
            check.ok = false
            check.code = 'DANGLING_ACTIVE_VOICE_SYMLINK'
        } else if (kind === 'copy') {
            if (
                !exp ||
                !(await isNonEmptyFile(exp.expected)) ||
                (await sha256File(target)) !== (await sha256File(exp.expected))
            ) {
                check.ok = false
                check.code = 'ACTIVE_VOICE_SYMLINK_MISMATCH'
            }
        } else if (
            path.dirname(target) !== versionsDir ||
            (exp && path.resolve(target) !== path.resolve(exp.expected))
        ) {
            check.ok = false
            check.code = 'ACTIVE_VOICE_SYMLINK_MISMATCH'
        }

        if (check.code === 'DANGLING_ACTIVE_VOICE_SYMLINK')
            report.dangling.push(name)
        if (check.code === 'ACTIVE_VOICE_SYMLINK_MISMATCH')
            report.mismatched.push(name)
        report.checked.push(check)
    }

    report.intact =
        report.dangling.length === 0 && report.mismatched.length === 0
    return report
}

export const verifySymlinkIntegrity = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const dat: any = bal?.dat || {}
    const report = await inspectSymlinkIntegrity(vaultRootOf(cpy, bal))
    for (const c of report.checked) {
        const rel = toPosix(
            path.relative(
                path.dirname(c.pointerPath),
                c.resolvedTarget || c.pointerPath,
            ),
        )
        await emitConsole(
            ste,
            c.ok
                ? `>> [SYMLINK:OK] active/${c.pointerName} -> ${rel} (${c.kind})`
                : `:: [SYMLINK:ERR] ${c.code}: active/${c.pointerName} (${c.kind})`,
        )
    }
    await emitConsole(
        ste,
        `>> [SYMLINK] Active pointer integrity ${report.intact ? '[INTACT]' : '[BROKEN]'} (${report.checked.length} checked).`,
    )
    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'verify-symlink-integrity',
                val: report.intact ? 0 : 1,
                dat: report as any,
            },
        })
    }
    if (dat.strict === true && !report.intact) {
        throw new Error(
            `DANGLING_ACTIVE_VOICE_SYMLINK: ${[...report.dangling, ...report.mismatched].join(', ')}`,
        )
    }
    return cpy
}

export const inspectOrphanTakes = async (
    vaultRoot: string,
): Promise<OrphanTakeAuditResult> => {
    const voicesBase = path.join(vaultRoot, 'voices')
    const versionsDir = path.join(voicesBase, 'versions')
    const manifest = await readJsonSafe(
        path.join(voicesBase, 'voice_manifest.json'),
    )
    const voices = manifest?.voices || {}
    const referenced = new Set<string>()
    const addRef = (rel: any) => {
        if (typeof rel === 'string' && rel) referenced.add(path.basename(rel))
    }

    for (const slug of Object.keys(voices)) {
        const entry = voices[slug] || {}
        addRef(entry.reference_wav_path)
        addRef(`${slug}_${String(entry.active_version || 'v1')}.wav`)
        for (const rel of entry.version_history || []) addRef(rel)
        for (const cond of Object.values<any>(entry.conditions || {})) {
            addRef(cond?.reference_wav_path)
        }
        for (const [tag, meta] of Object.entries<any>(
            entry.condition_variants || {},
        )) {
            addRef(`${slug}_${tag}_${String(meta?.active_version || 'v1')}.wav`)
        }
    }

    const scanned = (await fs.pathExists(versionsDir))
        ? (await fs.readdir(versionsDir))
              .filter(
                  (f) => f.toLowerCase().endsWith('.wav') && !f.startsWith('.'),
              )
              .sort()
        : []
    const orphans = scanned.filter((f) => !referenced.has(f))
    return {
        clean: orphans.length === 0,
        scanned,
        referenced: [...referenced].sort(),
        orphans,
    }
}

export const auditOrphanTakes = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const dat: any = bal?.dat || {}
    const result = await inspectOrphanTakes(vaultRootOf(cpy, bal))
    for (const f of result.orphans) {
        await emitConsole(
            ste,
            `:: [ORPHAN:WARN] ORPHAN_VOICE_TAKE_DETECTED: versions/${f}`,
        )
    }
    await emitConsole(
        ste,
        `>> [ORPHAN] Scanned ${result.scanned.length} take(s): ${result.clean ? '[CLEAN]' : `[${result.orphans.length} ORPHAN(S)]`}.`,
    )
    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'audit-orphan-takes',
                val: result.orphans.length,
                dat: result as any,
            },
        })
    }
    if (dat.strict === true && !result.clean) {
        throw new Error(
            `ORPHAN_VOICE_TAKE_DETECTED: ${result.orphans.join(', ')}`,
        )
    }
    return cpy
}

export const registerVoiceTake = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const payload: VoiceTakeRegistrationPayload =
        (bal?.dat as any) || ({} as any)
    const characterSlug = String(payload.characterSlug || bal?.src || '')
        .trim()
        .toLowerCase()
    if (!SLUG_PATTERN.test(characterSlug)) {
        return fail(
            bal,
            ste,
            'register-voice-take',
            `VOICE_SLUG_FORMAT_BREACH: Character slug [${characterSlug}] is invalid.`,
        )
    }

    const clearance = evaluateLegalClearance({
        ...(payload.clearance || ({} as any)),
        characterSlug,
    })
    if (!clearance.valid) {
        await emitConsole(
            ste,
            `>> [LEGAL:HALT] ${clearance.statusCode}: ${clearance.message}`,
        )
        if (bal?.slv)
            bal.slv({ voiBit: { idx: 'register-voice-take-fail', val: -1 } })
        throw new Error(`${clearance.statusCode}: ${clearance.message}`)
    }
    await emitConsole(
        ste,
        `>> [LEGAL:PASS] Character [${characterSlug}] clearance verified (${clearance.clearanceToken})`,
    )

    const sourcePath = path.resolve(String(payload.sourceWavPath || ''))
    if (!payload.sourceWavPath || !(await fs.pathExists(sourcePath))) {
        return fail(
            bal,
            ste,
            'register-voice-take',
            `VOICE_SOURCE_MISSING_BREACH: Source take [${payload.sourceWavPath}] not found.`,
        )
    }
    const sourceBuf = await fs.readFile(sourcePath)
    const header = parseWavHeader(sourceBuf)
    if (!isCanonicalReferenceWav(header)) {
        return fail(
            bal,
            ste,
            'register-voice-take',
            `VOICE_TAKE_FORMAT_BREACH: [${path.basename(sourcePath)}] must be RIFF/WAVE PCM ${REQUIRED_SAMPLE_RATE_HZ} Hz ${REQUIRED_BIT_DEPTH}-bit mono > ${MIN_REFERENCE_WAV_BYTES} bytes (got ${header.sampleRateHz} Hz ${header.bitDepth}-bit ${header.channels}ch ${header.fileBytes} bytes).`,
        )
    }

    const vaultRoot = vaultRootOf(cpy, bal)
    const voicesBase = path.join(vaultRoot, 'voices')
    const versionsDir = path.join(voicesBase, 'versions')
    const manifestPath = path.join(voicesBase, 'voice_manifest.json')
    await fs.ensureDir(versionsDir)

    const manifest = (await readJsonSafe(manifestPath)) || {}
    if (!manifest.voices || typeof manifest.voices !== 'object')
        manifest.voices = {}
    const existing = manifest.voices[characterSlug]
    const versionTag =
        payload.versionTag ||
        (existing ? `v${versionNumberOf(existing.active_version) + 1}` : 'v1')
    if (!/^v[1-9]\d*$/.test(versionTag)) {
        return fail(
            bal,
            ste,
            'register-voice-take',
            `VOICE_VERSION_TAG_BREACH: Version tag [${versionTag}] is invalid.`,
        )
    }

    const fileName = `${characterSlug}_${versionTag}.wav`
    const destPath = path.join(versionsDir, fileName)
    if (await fs.pathExists(destPath)) {
        return fail(
            bal,
            ste,
            'register-voice-take',
            `VOICE_TAKE_VERSION_COLLISION_BREACH: versions/${fileName} already exists.`,
        )
    }

    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const stagePath = path.join(versionsDir, `.tmp_take_${nonce}.wav`)
    await fs.writeFile(stagePath, sourceBuf)
    await fs.rename(stagePath, destPath)
    await fs.chmod(destPath, 0o444)
    const sha256 = createHash('sha256').update(sourceBuf).digest('hex')

    await retargetActiveSymlink(
        path.join(voicesBase, 'active'),
        characterSlug,
        fileName,
    )
    const embeddingAbs = await generateSpeakerEmbedding(
        path.join(voicesBase, 'embeddings'),
        characterSlug,
        versionNumberOf(versionTag),
    )

    const referenceRel = `voices/versions/${fileName}`
    const history: string[] = [...(existing?.version_history || [])]
    const priorRef = existing ? baseTakeRelPath(characterSlug, existing) : ''
    if (priorRef && priorRef !== referenceRel && !history.includes(priorRef)) {
        history.push(priorRef)
    }

    manifest.voices[characterSlug] = {
        ...(existing || {}),
        display_name:
            payload.displayName || existing?.display_name || characterSlug,
        base_state: existing?.base_state || 'neutral',
        active_version: versionTag,
        reference_wav_path: referenceRel,
        active_pointer: `voices/active/${characterSlug}.wav`,
        embedding_path: toPosix(path.relative(vaultRoot, embeddingAbs)),
        sha256,
        sample_rate_hz: header.sampleRateHz,
        bit_depth: header.bitDepth,
        channels: header.channels,
        legal_clearance_token: clearance.clearanceToken,
        consent_verified: true,
        talent_identifier: payload.clearance.talentIdentifier,
        signed_at: payload.clearance.signedAtIso,
        jurisdiction: payload.clearance.jurisdiction,
        consent_digest: payload.clearance.sha256ConsentDigest,
        ...(history.length ? { version_history: history } : {}),
    }
    await writeManifestAtomic(manifestPath, manifest)

    await emitConsole(
        ste,
        `>> [VOICE:REGISTER] Registered ${characterSlug} (${versionTag})`,
    )
    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'register-voice-take',
                val: versionNumberOf(versionTag),
                dat: canonicalize(manifest.voices[characterSlug]),
                src: characterSlug,
            },
        })
    }
    return cpy
}

export const updateVoice = async (
    cpy: VoiceModel,
    bal: VoiceBit,
    ste?: any,
): Promise<VoiceModel> => {
    const dat: Partial<Voice> = (bal?.dat as any) || {}
    if (typeof dat.voicesRoot === 'string' && dat.voicesRoot.trim()) {
        cpy.voicesRoot = path.resolve(dat.voicesRoot)
    }
    if (
        Number.isInteger(dat.activeVersionsCount) &&
        dat.activeVersionsCount >= 0
    ) {
        cpy.activeVersionsCount = dat.activeVersionsCount
    }
    await emitConsole(
        ste,
        `>> [VOICE] Voice model updated (root: ${cpy.voicesRoot}).`,
    )
    if (bal?.slv) {
        bal.slv({
            voiBit: {
                idx: 'update-voice',
                val: 0,
                dat: {
                    voicesRoot: cpy.voicesRoot,
                    activeVersionsCount: cpy.activeVersionsCount,
                } as any,
            },
        })
    }
    return cpy
}
