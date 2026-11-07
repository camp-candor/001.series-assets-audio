import { AudioLockfileManifest } from '../fce/sync.bit.js';

export function verifyCrossRepoLockfileParity(localLockfile: AudioLockfileManifest, consumerLockfile: Partial<AudioLockfileManifest>) {
    if (localLockfile.merkle_root_sha256 !== consumerLockfile.merkle_root_sha256) {
        throw new Error('CROSS_REPO_LOCKFILE_DRIFT_BREACH');
    }
}\n