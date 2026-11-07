import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { AudioLockfileManifest, AudioLockfileEntry } from '../fce/sync.bit.js';

function computeSha256(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

export function compileAudioLockfile(repoRoot: string): AudioLockfileManifest {
    const voiceManifestPath = path.join(repoRoot, 'voices/voice_manifest.json');
    const lexiconPath = path.join(repoRoot, 'voices/lexicon.json');
    const foleyRegistryPath = path.join(repoRoot, 'foley/registry.json');
    const musicManifestPath = path.join(repoRoot, 'music/manifest.json');

    const voiceSha = computeSha256(voiceManifestPath);
    const lexiconSha = computeSha256(lexiconPath);
    const foleySha = computeSha256(foleyRegistryPath);
    const musicSha = computeSha256(musicManifestPath);

    const compositeSource = [voiceSha, lexiconSha, foleySha, musicSha].sort().join('');
    const merkleRoot = crypto.createHash('sha256').update(compositeSource).digest('hex');

    const assets: Record<string, AudioLockfileEntry> = {};

    const tryLoadAssets = (manifestPath: string, domain: 'voice' | 'foley' | 'music' | 'lexicon') => {
        if (!fs.existsSync(manifestPath)) return;
        try {
            const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const entries = data.assets || data.entries || data.voices || data.cues || data.stems || {};
            for (const [id, entry] of Object.entries<any>(entries)) {
                assets[id] = {
                    asset_id: id,
                    domain,
                    path: entry.path || '',
                    version: entry.version || '1.0.0',
                    sha256: entry.sha256 || ''
                };
            }
        } catch (e) {
            // ignore
        }
    }

    tryLoadAssets(voiceManifestPath, 'voice');
    tryLoadAssets(lexiconPath, 'lexicon');
    tryLoadAssets(foleyRegistryPath, 'foley');
    tryLoadAssets(musicManifestPath, 'music');

    const lockfile: AudioLockfileManifest = {
        schema_version: '1.0.0',
        series_scope: 'default',
        merkle_root_sha256: merkleRoot,
        voice_manifest_sha256: voiceSha,
        lexicon_sha256: lexiconSha,
        foley_registry_sha256: foleySha,
        music_manifest_sha256: musicSha,
        assets
    };

    const lockfilePath = path.join(repoRoot, 'voices/audio_lockfile.json');
    fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
    console.log('>> [SYNC:LOCKFILE:SEALED]');

    return lockfile;
}

export function synchronizeFleetManifests(cpy: any, bal: any, ste: any) {
    return compileAudioLockfile(process.cwd());
}
