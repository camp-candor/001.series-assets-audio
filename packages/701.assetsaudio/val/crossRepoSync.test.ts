import { expect, test, describe } from 'vitest';
import { verifyCrossRepoLockfileParity } from '../25.sync.unit/buz/lockfileAudit.buzz.js';
import { calculateVersionBumpBlastRadius } from '../25.sync.unit/buz/blastRadius.buzz.js';

describe('Cross Repo Sync', () => {
    test('verifyCrossRepoLockfileParity', () => {
        expect(() => verifyCrossRepoLockfileParity({ merkle_root_sha256: 'a' } as any, { merkle_root_sha256: 'b' } as any)).toThrowError('CROSS_REPO_LOCKFILE_DRIFT_BREACH');
        expect(() => verifyCrossRepoLockfileParity({ merkle_root_sha256: 'a' } as any, { merkle_root_sha256: 'a' } as any)).not.toThrowError();
    });

    test('calculateVersionBumpBlastRadius', () => {
        const result = calculateVersionBumpBlastRadius(['a'], []);
        expect(result).toEqual({ invalidatedSceneIds: [], invalidatedLineIds: [] });
    });
});\n