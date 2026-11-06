import { describe, it, expect } from 'vitest'
import { parseFfprobeOutput } from '../24.compliance.unit/buz/ffprobeInspect.buzz.js'
import { probeAudioContainer } from '../24.compliance.unit/buz/ffprobeInspect.buzz.js'
import { classifySignalGeometry } from '../24.compliance.unit/buz/geometryClassify.buzz.js'
import { ComplianceModel } from '../24.compliance.unit/compliance.model.js'
import type { AudioProbeResult } from '../24.compliance.unit/fce/compliance.bit.js'

describe('Autonomous Container Probing Classification Feature Tests', () => {
    const mock48k24bMonoWav = {
        streams: [
            {
                codec_name: 'pcm_s24le',
                codec_type: 'audio',
                sample_rate: '48000',
                channels: 1,
                bits_per_raw_sample: '24',
                duration: '4.250000',
            },
        ],
        format: {
            format_name: 'wav',
            duration: '4.250000',
            bit_rate: '1152000',
        },
    }

    const mock44k16bStereoWav = {
        streams: [
            {
                codec_name: 'pcm_s16le',
                codec_type: 'audio',
                sample_rate: '44100',
                channels: 2,
                bits_per_raw_sample: '16',
                duration: '3.100000',
            },
        ],
        format: {
            format_name: 'wav',
            duration: '3.100000',
            bit_rate: '1411200',
        },
    }

    const mockFlacStream = {
        streams: [
            {
                codec_name: 'flac',
                codec_type: 'audio',
                sample_rate: '48000',
                channels: 2,
                bits_per_raw_sample: '24',
                duration: '10.500000',
            },
        ],
        format: {
            format_name: 'flac',
            duration: '10.500000',
        },
    }

    const mockMp3Stream = {
        streams: [
            {
                codec_name: 'mp3',
                codec_type: 'audio',
                sample_rate: '44100',
                channels: 2,
                duration: '12.000000',
            },
        ],
        format: {
            format_name: 'mp3',
            duration: '12.000000',
            bit_rate: '320000',
        },
    }

    it('correctly parses ffprobe raw output into structured AudioProbeResult down to milliseconds', () => {
        const res = parseFfprobeOutput(mock48k24bMonoWav, 'voices/take.wav')
        expect(res.durationMs).toBe(4250)
        expect(res.sampleRate).toBe(48000)
        expect(res.channels).toBe(1)
        expect(res.bitDepth).toBe(24)
        expect(res.codecName).toBe('pcm_s24le')
        expect(res.containerFormat).toBe('wav')
    })

    it('classifies 48 kHz 24-bit linear PCM mono as READY_FOR_VAULT', async () => {
        const model = new ComplianceModel()
        const probe = parseFfprobeOutput(
            mock48k24bMonoWav,
            'voices/char_v1.wav',
        )

        let slvResult: any = null
        const bit: any = {
            idx: 'test-classify',
            dat: probe,
            slv: (r: any) => {
                slvResult = r
            },
        }

        await classifySignalGeometry(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.cmpBit.dat.category).toBe('LINEAR_PCM')
        expect(slvResult.cmpBit.dat.isBroadcastCompliantGeometry).toBe(true)
        expect(slvResult.cmpBit.dat.geometryIssues.length).toBe(0)
        expect(slvResult.cmpBit.dat.recommendation).toBe('READY_FOR_VAULT')
        expect(model.complianceStatus).toBe('COMPLIANT')
    })

    it('classifies 44.1 kHz 16-bit stereo WAV as NEEDS_CONFORMANCE with issues', async () => {
        const model = new ComplianceModel()
        const probe = parseFfprobeOutput(
            mock44k16bStereoWav,
            'voices/raw_stereo.wav',
        )

        let slvResult: any = null
        const bit: any = {
            idx: 'test-classify',
            dat: probe,
            slv: (r: any) => {
                slvResult = r
            },
        }

        await classifySignalGeometry(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.cmpBit.dat.category).toBe('LINEAR_PCM')
        expect(slvResult.cmpBit.dat.isBroadcastCompliantGeometry).toBe(false)
        expect(slvResult.cmpBit.dat.recommendation).toBe('NEEDS_CONFORMANCE')
        expect(slvResult.cmpBit.dat.geometryIssues).toContain(
            'SAMPLE_RATE_DEVIATION_44100_HZ',
        )
        expect(slvResult.cmpBit.dat.geometryIssues).toContain(
            'BIT_DEPTH_DEVIATION_16_BIT',
        )
        expect(slvResult.cmpBit.dat.geometryIssues).toContain(
            'CHANNEL_TOPOLOGY_NON_MONO_2_CH',
        )
        expect(model.complianceStatus).toBe('NEEDS_CONFORMANCE')
    })

    it('classifies FLAC stream as LOSSLESS_COMPRESSED needing conformance', async () => {
        const model = new ComplianceModel()
        const probe = parseFfprobeOutput(mockFlacStream, 'audio/track.flac')

        let slvResult: any = null
        const bit: any = {
            idx: 'test-classify',
            dat: probe,
            slv: (r: any) => {
                slvResult = r
            },
        }

        await classifySignalGeometry(model, bit)

        expect(slvResult.cmpBit.dat.category).toBe('LOSSLESS_COMPRESSED')
        expect(slvResult.cmpBit.dat.recommendation).toBe('NEEDS_CONFORMANCE')
    })

    it('classifies MP3 stream as LOSSY_STREAM needing conformance', async () => {
        const model = new ComplianceModel()
        const probe = parseFfprobeOutput(mockMp3Stream, 'audio/track.mp3')

        let slvResult: any = null
        const bit: any = {
            idx: 'test-classify',
            dat: probe,
            slv: (r: any) => {
                slvResult = r
            },
        }

        await classifySignalGeometry(model, bit)

        expect(slvResult.cmpBit.dat.category).toBe('LOSSY_STREAM')
        expect(slvResult.cmpBit.dat.recommendation).toBe('NEEDS_CONFORMANCE')
    })

    it('classifies PyTorch embedding tensor as TENSOR_EMBEDDING and READY_FOR_VAULT', async () => {
        const model = new ComplianceModel()
        const probe: AudioProbeResult = {
            filePath: 'voices/embeddings/char_v1.pt',
            containerFormat: 'pt',
            durationMs: 0,
            sampleRate: 0,
            channels: 0,
            bitDepth: 0,
            codecName: 'tensor',
            bitRate: 0,
        }

        let slvResult: any = null
        const bit: any = {
            idx: 'test-classify',
            dat: probe,
            slv: (r: any) => {
                slvResult = r
            },
        }

        await classifySignalGeometry(model, bit)

        expect(slvResult.cmpBit.dat.category).toBe('TENSOR_EMBEDDING')
        expect(slvResult.cmpBit.dat.recommendation).toBe('READY_FOR_VAULT')
        expect(slvResult.cmpBit.dat.isBroadcastCompliantGeometry).toBe(true)
    })

    it('rejects classification payload when probe data is missing', async () => {
        const model = new ComplianceModel()
        const bit: any = {
            idx: 'test-classify-empty',
        }

        await expect(classifySignalGeometry(model, bit)).rejects.toThrow(
            'CLASSIFICATION_PAYLOAD_MISSING',
        )
    })

    it('executes probeAudioContainer with mock dat buffer without spawning child process', async () => {
        const model = new ComplianceModel()
        let slvResult: any = null

        const bit: any = {
            idx: 'test-mock-probe',
            src: 'voices/char_v1.wav',
            dat: {
                mockFfprobeJson: mock48k24bMonoWav,
            },
            slv: (r: any) => {
                slvResult = r
            },
        }

        await probeAudioContainer(model, bit)

        expect(slvResult).toBeDefined()
        expect(slvResult.cmpBit.val).toBe(4250)
        expect(model.lastProbeResult?.sampleRate).toBe(48000)
    })

    it('fails closed when probe target file path is empty', async () => {
        const model = new ComplianceModel()
        let slvResult: any = null
        const bit: any = {
            idx: 'test-empty-probe',
            src: '',
            slv: (r: any) => {
                slvResult = r
            },
        }

        await expect(probeAudioContainer(model, bit)).rejects.toThrow(
            'PROBE_TARGET_EMPTY',
        )
        expect(slvResult).toBeDefined()
        expect(slvResult.cmpBit.val).toBe(-1)
    })

    it('fails closed when probe target file does not exist on disk', async () => {
        const model = new ComplianceModel()
        let slvResult: any = null
        const bit: any = {
            idx: 'test-not-found-probe',
            src: 'non_existent_file_take99.wav',
            slv: (r: any) => {
                slvResult = r
            },
        }

        await expect(probeAudioContainer(model, bit)).rejects.toThrow(
            'PROBE_FILE_NOT_FOUND',
        )
        expect(slvResult).toBeDefined()
        expect(slvResult.cmpBit.val).toBe(-1)
    })
})
