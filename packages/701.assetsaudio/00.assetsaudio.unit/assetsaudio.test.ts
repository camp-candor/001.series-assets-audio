import { describe, it, expect, vi } from 'vitest'
import { initAssetsaudio } from './buz/assetsaudio.buzz.js'
import { AssetsaudioModel } from './assetsaudio.model.js'

describe('assetsaudio', () => {
    it('should initialize assetsaudio', () => {
        const model = new AssetsaudioModel()
        const state = {
            hunt: vi.fn().mockResolvedValue({}),
            dispatch: vi.fn(),
        } as any

        const slv = vi.fn()
        const bal = { idx: 'test', slv } as any

        // Check if initAssetsaudio is a function and can be called
        expect(typeof initAssetsaudio).toBe('function')

        const result = initAssetsaudio(model, bal, state)
        expect(result).toBe(model)
        //expect(slv).toHaveBeenCalledWith({ intBit: { idx: 'init-assetsaudio' } });
    })

    it('should wake up the assetsaudio if url is provided', async () => {
        const model = new AssetsaudioModel()
        const state = {} as any
        const slv = vi.fn()
        const bal = { idx: 'test', slv } as any

        const urlassetsaudio =
            'https://zero00-assetsaudio.onrender.com/api/assetsaudio/test'

        const mockResponseassetsaudio = { status: 'assetsaudio-awake' }

        const globalFetch = vi
            .spyOn(global, 'fetch')
            .mockImplementation((url) => {
                if (url === urlassetsaudio) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(mockResponseassetsaudio),
                    } as any)
                }
                return Promise.reject(new Error('Unknown URL'))
            })

        initAssetsaudio(model, bal, state)

        // Wait for the promise in initAssetsaudio to resolve
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(globalFetch).toHaveBeenCalledWith(urlassetsaudio)
        expect(slv).toHaveBeenCalledWith({
            intBit: {
                idx: 'init-assetsaudio',
                dat: {
                    assetsaudio: mockResponseassetsaudio,
                },
            },
        })

        globalFetch.mockRestore()
    })

    it('should handle fetch errors', async () => {
        const model = new AssetsaudioModel()
        const state = {} as any
        const slv = vi.fn()
        const bal = { idx: 'test', slv } as any

        const urlassetsaudio =
            'https://zero00-assetsaudio.onrender.com/api/assetsaudio/test'

        const errorMessage = 'Network error'
        const globalFetch = vi
            .spyOn(global, 'fetch')
            .mockImplementation((url) => {
                if (url === urlassetsaudio) {
                    return Promise.reject(new Error(errorMessage))
                }
                return Promise.resolve({
                    ok: true,
                    json: async () => ({}),
                } as any)
            })

        initAssetsaudio(model, bal, state)

        // Wait for the promise in initAssetsaudio to resolve
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(globalFetch).toHaveBeenCalledWith(urlassetsaudio)

        expect(slv).toHaveBeenCalledWith({
            intBit: { idx: 'init-assetsaudio-err', dat: errorMessage },
        })

        globalFetch.mockRestore()
    })
})
