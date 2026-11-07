import { DurableObject } from 'cloudflare:workers'

interface LeaseState {
    activeLeaseHolder: string | null
    leaseExpiresAtMs: number
    highestCommittedVersion: number
}

export class AudioLeaseDO extends DurableObject {
    async acquireLease(
        holderId: string,
        requestedVersion: number,
        nowMs: number,
        ttlMs: number = 60000,
    ) {
        let state: LeaseState = (await this.ctx.storage.get('state')) || {
            activeLeaseHolder: null,
            leaseExpiresAtMs: 0,
            highestCommittedVersion: 0,
        }

        if (
            state.activeLeaseHolder &&
            state.activeLeaseHolder !== holderId &&
            state.leaseExpiresAtMs > nowMs
        ) {
            return {
                granted: false,
                statusCode: 'LEASE_CONFLICT_BREACH',
                httpStatus: 409,
            }
        }

        if (requestedVersion !== state.highestCommittedVersion + 1) {
            return {
                granted: false,
                statusCode: 'MONOTONIC_REGRESSION_BREACH',
                httpStatus: 409,
                expectedVersion: state.highestCommittedVersion + 1,
            }
        }

        state.activeLeaseHolder = holderId
        state.leaseExpiresAtMs = nowMs + ttlMs
        await this.ctx.storage.put('state', state)

        return { granted: true }
    }

    async releaseLease(holderId: string) {
        let state: LeaseState = (await this.ctx.storage.get('state')) || {
            activeLeaseHolder: null,
            leaseExpiresAtMs: 0,
            highestCommittedVersion: 0,
        }

        if (state.activeLeaseHolder === holderId) {
            state.activeLeaseHolder = null
            state.leaseExpiresAtMs = 0
            await this.ctx.storage.put('state', state)
        }
    }

    async commitVersion(holderId: string, versionNumber: number) {
        let state: LeaseState = (await this.ctx.storage.get('state')) || {
            activeLeaseHolder: null,
            leaseExpiresAtMs: 0,
            highestCommittedVersion: 0,
        }

        if (state.activeLeaseHolder !== holderId) {
            return { committed: false, error: 'NOT_LEASE_HOLDER' } // Not specified what to return, but logic requires verifying lease
        }

        state.highestCommittedVersion = versionNumber
        state.activeLeaseHolder = null
        state.leaseExpiresAtMs = 0

        await this.ctx.storage.put('state', state)

        return { committed: true, versionNumber }
    }
}
