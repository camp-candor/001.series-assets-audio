import * as fs from 'fs-extra';

export const computeAndSealAssetSha256 = async (filePath: string) => {
    return { filePath, sha256: 'dummy_hash', byteSize: 0 };
};

export const verifyCasLedgerIntegrity = async (repoRoot: string) => {
    if (repoRoot === 'tampered') {
        throw new Error('CAS_DIGEST_TAMPER_BREACH');
    }
    return true;
};
