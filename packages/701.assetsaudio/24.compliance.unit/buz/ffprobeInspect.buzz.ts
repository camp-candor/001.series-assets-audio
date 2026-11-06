import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import type { ComplianceModel } from '../compliance.model.js'
import type ComplianceBit from '../fce/compliance.bit.js'
import type { AudioProbeResult } from '../fce/compliance.bit.js'

export const initCompliance = (
    cpy: ComplianceModel,
    bal: ComplianceBit,
    ste?: any,
): ComplianceModel => {
    if (ste?.hunt) {
        ste.hunt('[Console action] Update Console', {
            idx: 'cns00',
            src: '>> [COMPLIANCE] Compliance and Probing Unit Initialized.',
        }).catch(() => {})
    }
    if (bal?.slv) {
        bal.slv({ cmpBit: { idx: 'init-compliance', val: 0 } })
    }
    return cpy
}

export const parseFfprobeOutput = (
    rawJson: any,
    targetFile: string,
): AudioProbeResult => {
    const format = rawJson.format || {}
    const audioStream =
        (rawJson.streams || []).find((s: any) => s.codec_type === 'audio') || {}

    const durationSec = parseFloat(
        audioStream.duration || format.duration || '0',
    )
    const durationMs = Math.round(durationSec * 1000)
    const sampleRate = parseInt(audioStream.sample_rate || '0', 10)
    const channels = parseInt(audioStream.channels || '0', 10)
    const bitDepth = parseInt(
        audioStream.bits_per_raw_sample || audioStream.bits_per_sample || '0',
        10,
    )
    const codecName = (audioStream.codec_name || '').toLowerCase()
    const containerFormat = (
        format.format_name || path.extname(targetFile).replace('.', '')
    ).toLowerCase()
    const bitRate = parseInt(format.bit_rate || audioStream.bit_rate || '0', 10)

    return {
        filePath: targetFile,
        containerFormat,
        durationMs,
        sampleRate,
        channels,
        bitDepth,
        codecName,
        bitRate,
        rawFfprobeJson: rawJson,
    }
}

export const probeAudioContainer = async (
    cpy: ComplianceModel,
    bal: ComplianceBit,
    ste?: any,
): Promise<ComplianceModel> => {
    const targetFile = bal?.src || (bal?.dat as any)?.filePath || ''

    if (!targetFile) {
        const errorMsg =
            'PROBE_TARGET_EMPTY: No file path provided for ffprobe analysis.'
        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: `:: [PROBE:FAIL] ${errorMsg}`,
                })
                .catch(() => {})
        }
        const err = new Error(errorMsg)
        if (bal?.slv) {
            bal.slv({
                cmpBit: { idx: 'probe-audio-container-fail', val: -1, src: '' },
            })
        }
        throw err
    }

    // Support direct mock injection for automated tests or headless environments
    if ((bal?.dat as any)?.mockFfprobeJson) {
        const probeResult = parseFfprobeOutput(
            (bal?.dat as any).mockFfprobeJson,
            targetFile,
        )
        cpy.lastProbeResult = probeResult

        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: `>> [PROBE] Extracted container metadata (mock) for ${path.basename(targetFile)}: ${probeResult.codecName}, ${probeResult.sampleRate} Hz, ${probeResult.channels} ch, ${probeResult.durationMs} ms.`,
                })
                .catch(() => {})
        }

        if (bal?.slv) {
            bal.slv({
                cmpBit: {
                    idx: 'probe-audio-container',
                    val: probeResult.durationMs,
                    dat: probeResult,
                    src: targetFile,
                },
            })
        }
        return cpy
    }

    const resolved = path.resolve(process.cwd(), targetFile)
    if (!(await fs.pathExists(resolved))) {
        const errorMsg = `PROBE_FILE_NOT_FOUND: Inode does not exist: ${resolved}`
        if (ste?.hunt) {
            await ste
                .hunt('[Console action] Update Console', {
                    idx: 'cns00',
                    src: `:: [PROBE:FAIL] ${errorMsg}`,
                })
                .catch(() => {})
        }
        const err = new Error(errorMsg)
        if (bal?.slv) {
            bal.slv({
                cmpBit: {
                    idx: 'probe-audio-container-fail',
                    val: -1,
                    src: resolved,
                },
            })
        }
        throw err
    }

    return new Promise((resolve, reject) => {
        const args = [
            '-v',
            'quiet',
            '-print_format',
            'json',
            '-show_format',
            '-show_streams',
            resolved,
        ]
        const proc = spawn('ffprobe', args)

        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (d) => {
            stdout += d.toString()
        })

        proc.stderr.on('data', (d) => {
            stderr += d.toString()
        })

        proc.on('close', async (code) => {
            if (code !== 0) {
                const errorMsg = `PROBE_SUBPROCESS_FAILURE: ffprobe exited with code ${code}. ${stderr}`
                if (ste?.hunt) {
                    await ste
                        .hunt('[Console action] Update Console', {
                            idx: 'cns00',
                            src: `:: [PROBE:FAIL] ${errorMsg}`,
                        })
                        .catch(() => {})
                }
                const err = new Error(errorMsg)
                if (bal?.slv) {
                    bal.slv({
                        cmpBit: {
                            idx: 'probe-audio-container-fail',
                            val: code || -1,
                            src: resolved,
                        },
                    })
                }
                return reject(err)
            }

            try {
                const parsed = JSON.parse(stdout)
                const probeResult = parseFfprobeOutput(parsed, resolved)
                cpy.lastProbeResult = probeResult

                if (ste?.hunt) {
                    await ste
                        .hunt('[Console action] Update Console', {
                            idx: 'cns00',
                            src: `>> [PROBE] Extracted container metadata for ${path.basename(resolved)}: ${probeResult.codecName}, ${probeResult.sampleRate} Hz, ${probeResult.channels} ch, ${probeResult.durationMs} ms.`,
                        })
                        .catch(() => {})
                }

                if (bal?.slv) {
                    bal.slv({
                        cmpBit: {
                            idx: 'probe-audio-container',
                            val: probeResult.durationMs,
                            dat: probeResult,
                            src: resolved,
                        },
                    })
                }
                resolve(cpy)
            } catch (jsonErr: any) {
                const parseError = new Error(
                    `PROBE_JSON_PARSE_ERROR: Failed to parse ffprobe output: ${jsonErr.message}`,
                )
                if (bal?.slv) {
                    bal.slv({
                        cmpBit: {
                            idx: 'probe-audio-container-fail',
                            val: -1,
                            src: resolved,
                        },
                    })
                }
                reject(parseError)
            }
        })

        proc.on('error', async (err: any) => {
            const errorMsg = `PROBE_SPAWN_ERROR: Failed to execute ffprobe. Ensure ffmpeg/ffprobe is installed. ${err.message}`
            if (ste?.hunt) {
                await ste
                    .hunt('[Console action] Update Console', {
                        idx: 'cns00',
                        src: `:: [PROBE:FAIL] ${errorMsg}`,
                    })
                    .catch(() => {})
            }
            if (bal?.slv) {
                bal.slv({
                    cmpBit: {
                        idx: 'probe-audio-container-fail',
                        val: -1,
                        src: resolved,
                    },
                })
            }
            reject(new Error(errorMsg))
        })
    })
}
