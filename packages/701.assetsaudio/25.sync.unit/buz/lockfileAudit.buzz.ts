import { AudioLockfileManifest } from '../fce/sync.bit.js';

export function verifyCrossRepoLockfileParity(
    localLockfile: AudioLockfileManifest,
    consumerLockfile: Partial<AudioLockfileManifest>
): string[] {
    if (localLockfile.merkle_root_sha256 !== consumerLockfile.merkle_root_sha256) {
        const driftedAssetIds: string[] = [];
        const consumerAssets = consumerLockfile.assets || {};

        for (const [id, localAsset] of Object.entries(localLockfile.assets)) {
            const consumerAsset = consumerAssets[id];
            if (!consumerAsset || localAsset.sha256 !== consumerAsset.sha256) {
                driftedAssetIds.push(id);
            }
        }

        for (const id of Object.keys(consumerAssets)) {
            if (!localLockfile.assets[id]) {
                if (!driftedAssetIds.includes(id)) {
                    driftedAssetIds.push(id);
                }
            }
        }

        throw new Error(`CROSS_REPO_LOCKFILE_DRIFT_BREACH: ${driftedAssetIds.join(', ')}`);
    }

    return [];
}
