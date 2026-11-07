export interface AudioLockfileEntry {
    asset_id: string;
    domain: 'voice' | 'foley' | 'music' | 'lexicon';
    path: string;
    version: string;
    sha256: string;
}

export interface AudioLockfileManifest {
    schema_version: '1.0.0';
    series_scope: string;
    merkle_root_sha256: string;
    voice_manifest_sha256: string;
    lexicon_sha256: string;
    foley_registry_sha256: string;
    music_manifest_sha256: string;
    assets: Record<string, AudioLockfileEntry>;
}\n