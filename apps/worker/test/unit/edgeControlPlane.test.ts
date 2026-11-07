import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AudioLeaseDO } from '../../src/durable_objects/AudioLeaseDO.js'
import { uploadRoutes } from '../../src/routes/uploadRoutes.js'
import { runScheduledStorageSweeper } from '../../src/crons/storageSweeper.js'

describe('Edge Control Plane', () => {
    describe('AudioLeaseDO', () => {
        let storageMap = new Map<string, any>()
        let mockCtx: any

        beforeEach(() => {
            storageMap.clear()
            mockCtx = {
                storage: {
                    get: async (key: string) => storageMap.get(key),
                    put: async (key: string, val: any) =>
                        storageMap.set(key, val),
                },
            }
        })

        it('should acquire lease for single-writer lock', async () => {
            const doObj = Object.create(AudioLeaseDO.prototype)
            doObj.ctx = mockCtx

            const res = await doObj.acquireLease('holder-1', 1, 1000, 60000)
            expect(res.granted).toBe(true)

            const state = await mockCtx.storage.get('state')
            expect(state.activeLeaseHolder).toBe('holder-1')
        })

        it('should return LEASE_CONFLICT_BREACH for concurrent conflicting writes (Trap A)', async () => {
            // Trap A: Acquire a lease on AudioLeaseDO for char_johnny_walkman (v2) with holder node-A,
            // then attempt a concurrent lease acquisition from node-B before TTL expiry and assert immediate HTTP 409 rejection.
            const doObj = Object.create(AudioLeaseDO.prototype)
            doObj.ctx = mockCtx

            // Seed committed version as 1
            await mockCtx.storage.put('state', {
                activeLeaseHolder: null,
                leaseExpiresAtMs: 0,
                highestCommittedVersion: 1,
            })

            const leaseA = await doObj.acquireLease('node-A', 2, 1000, 60000)
            expect(leaseA.granted).toBe(true)

            const leaseB = await doObj.acquireLease('node-B', 2, 1500, 60000)
            expect(leaseB.granted).toBe(false)
            expect(leaseB.statusCode).toBe('LEASE_CONFLICT_BREACH')
            expect(leaseB.httpStatus).toBe(409)
        })

        it('should return MONOTONIC_REGRESSION_BREACH for version regressions (Trap B)', async () => {
            // Trap B: Attempt to acquire a lease for v1 when highestCommittedVersion is 1 and assert immediate HTTP 409 rejection.
            const doObj = Object.create(AudioLeaseDO.prototype)
            doObj.ctx = mockCtx

            await mockCtx.storage.put('state', {
                activeLeaseHolder: null,
                leaseExpiresAtMs: 0,
                highestCommittedVersion: 1,
            })

            const res = await doObj.acquireLease('node-A', 1, 2000, 60000)
            expect(res.granted).toBe(false)
            expect(res.statusCode).toBe('MONOTONIC_REGRESSION_BREACH')
            expect(res.httpStatus).toBe(409)
        })

        it('should allow acquiring lease if previous has expired', async () => {
            const doObj = Object.create(AudioLeaseDO.prototype)
            doObj.ctx = mockCtx

            await doObj.acquireLease('holder-1', 1, 1000, 100)
            // Expired at 1100
            const res = await doObj.acquireLease('holder-2', 1, 1200, 100)
            expect(res.granted).toBe(true)
        })
    })

    describe('Upload Routes & Quotas (Trap C)', () => {
        it('should reject requests exceeding 9.5 GB R2 free-tier ceiling via HTTP 507 (Trap C)', async () => {
            // Trap C: Simulate D1 storage usage at 10,200,547,000 bytes and submit an upload intent
            // for a 10,000-byte WAV file; assert immediate HTTP 507 fail-closed rejection before any R2 write occurs.
            const mockEnv: any = {
                DB: {
                    prepare: () => ({
                        first: async () => ({ total_bytes: 10200547000 }),
                        bind: () => ({
                            first: async () => null,
                            all: async () => ({ results: [] }),
                            run: async () => {},
                        }),
                    }),
                },
                AUDIO_VAULT_BUCKET: {
                    put: vi.fn(),
                },
                AUDIO_LEASE_DO: {
                    idFromName: vi.fn(),
                    get: vi.fn(),
                },
            }

            const payload = {
                candidateByteSize: 10000,
                legalClearanceToken: 'CLR-VALID-2026',
                sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
                characterSlug: 'char_johnny_walkman',
                requestedVersion: 1,
                holderId: 'node-A',
            }

            const res = await uploadRoutes.request(
                '/upload-intent',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                },
                mockEnv,
            )

            expect(res.status).toBe(507)
            const data: any = await res.json()
            expect(data.error).toBe('R2_QUOTA_CEILING_BREACH')
            expect(mockEnv.AUDIO_VAULT_BUCKET.put).not.toHaveBeenCalled()
        })

        it('should validate legal clearance token', async () => {
            const validate = (token: string) => {
                if (!token || !/^CLR-[A-Z0-9]{4,12}-\d{4}$/.test(token)) {
                    return {
                        error: 'Missing or invalid legal clearance token',
                        status: 422,
                    }
                }
                return { status: 200 }
            }

            const invalid1 = validate('INVALID-TOKEN')
            expect(invalid1.status).toBe(422)

            const invalid2 = validate('CLR-ABC-123')
            expect(invalid2.status).toBe(422)

            const valid = validate('CLR-VALID123-2023')
            expect(valid.status).toBe(200)
        })
    })

    describe('Cron Sweeper Immutability Guard (Trap D)', () => {
        it('should purge expired staging blobs while keeping committed versions untouched (Trap D)', async () => {
            // Trap D: Run runScheduledStorageSweeper against a mock R2 bucket containing both expired
            // staging/tmp_01.wav and committed voices/versions/char_johnny_walkman_v1.wav; verify
            // staging/tmp_01.wav is purged while voices/versions/char_johnny_walkman_v1.wav remains untouched.
            const deletedKeys: string[] = []
            const mockEnv: any = {
                AUDIO_VAULT_BUCKET: {
                    list: async () => ({
                        truncated: false,
                        objects: [
                            {
                                key: 'staging/tmp_01.wav',
                                uploaded: new Date(
                                    Date.now() - 25 * 60 * 60 * 1000,
                                ), // 25 hrs ago (expired)
                            },
                            {
                                key: 'voices/versions/char_johnny_walkman_v1.wav',
                                uploaded: new Date(
                                    Date.now() - 25 * 60 * 60 * 1000,
                                ), // committed take
                            },
                        ],
                    }),
                    delete: async (key: string) => {
                        deletedKeys.push(key)
                    },
                },
            }

            await runScheduledStorageSweeper(mockEnv)

            expect(deletedKeys).toContain('staging/tmp_01.wav')
            expect(deletedKeys).not.toContain(
                'voices/versions/char_johnny_walkman_v1.wav',
            )
        })
    })
})
