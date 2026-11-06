import fs from 'fs-extra'
import path from 'path'
import type { AssetsAudioModel } from '../assetsaudio.model.js'
import type AssetsAudioBit from '../fce/assetsaudio.bit.js'
import type { MasterAuditReport } from '../fce/assetsaudio.bit.js'
import { configureLfs } from './lfsConfig.buzz.js'
import { auditPoisonBuffers } from './poisonSentinel.buzz.js'
import { sweepStorageQuotas } from './quotaSweeper.buzz.js'

export const executeMasterAudit = async (
    cpy: AssetsAudioModel,
    bal: AssetsAudioBit,
    ste?: any,
): Promise<AssetsAudioModel> => {
    const rootDir = bal?.src || cpy.vaultRoot

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: '>> [ORCHESTRATOR] Commencing Master Acoustic Vault Audit Gauntlet...',
            })
            .catch(() => {})
    }

    // 1. Verify Git LFS configuration
    let lfsConfigured = false
    try {
        await configureLfs(cpy, { idx: 'cfg-lfs', src: rootDir }, ste)
        lfsConfigured = true
    } catch {
        lfsConfigured = false
    }

    // 2. Audit zero-byte poison buffers
    let poisonPassed = false
    let inspectedCount = 0
    let failedCount = 0
    try {
        let auditBitResult: any = null
        await auditPoisonBuffers(
            cpy,
            {
                idx: 'audit-poison',
                src: path.join(rootDir, 'voices'),
                slv: (res: any) => {
                    auditBitResult = res
                },
            },
            ste,
        )
        poisonPassed = true
        inspectedCount = auditBitResult?.asbBit?.val || 0
    } catch {
        poisonPassed = false
        failedCount = 1
    }

    // 3. Sweep storage quotas
    let quotaReport: any = null
    try {
        let sweepResult: any = null
        await sweepStorageQuotas(
            cpy,
            {
                idx: 'sweep-quota',
                src: rootDir,
                slv: (res: any) => {
                    sweepResult = res
                },
            },
            ste,
        )
        quotaReport = sweepResult?.asbBit?.dat
    } catch (err: any) {
        quotaReport = cpy.lastQuotaReport
    }

    // 4. Verify sub-vault directory existence
    const versionsPresent = await fs.pathExists(
        path.join(rootDir, 'voices', 'versions'),
    )
    const activePresent = await fs.pathExists(
        path.join(rootDir, 'voices', 'active'),
    )
    const embeddingsPresent = await fs.pathExists(
        path.join(rootDir, 'voices', 'embeddings'),
    )

    const overallStatus =
        lfsConfigured &&
        poisonPassed &&
        quotaReport?.status === 'HEALTHY' &&
        versionsPresent &&
        activePresent
            ? 'HEALTHY'
            : quotaReport?.status === 'EXCEEDED'
              ? 'QUOTA_EXCEEDED'
              : 'DEGRADED'

    cpy.vaultHealthStatus = overallStatus

    const masterReport: MasterAuditReport = {
        lfsConfigured,
        poisonBufferAudit: {
            passed: poisonPassed,
            inspectedFiles: inspectedCount,
            failedFiles: failedCount,
        },
        storageQuotaAudit: quotaReport,
        subVaultIntegrity: {
            versionsPresent,
            activePresent,
            embeddingsPresent,
        },
        overallStatus,
        timestamp: new Date().toISOString(),
    }

    if (ste?.hunt) {
        await ste
            .hunt('[Console action] Update Console', {
                idx: 'cns00',
                src: `>> [ORCHESTRATOR:REPORT] Overall Vault Health: [${overallStatus}] | LFS: [${lfsConfigured ? 'OK' : 'FAIL'}] | Media Files: [${cpy.trackedMediaFiles}].`,
            })
            .catch(() => {})
    }

    if (bal?.slv) {
        bal.slv({
            asbBit: {
                idx: 'execute-master-audit',
                val: overallStatus === 'HEALTHY' ? 0 : 1,
                dat: masterReport,
                src: rootDir,
            },
        })
    }

    return cpy
}
