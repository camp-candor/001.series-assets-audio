import * as fs from 'fs-extra';
import * as path from 'path';

export function verifyLoreCharacterAndCueParity(repoRoot: string) {
    const requiredCharacters = ['char_johnny_walkman', 'char_orbie_mayhaw'];
    const requiredFoleyCues = [
        'cue_dinner_plate_clink', 'cue_dinner_fork_scrape', 'cue_dinner_glass_set',
        'cue_dinner_chair_creak', 'cue_dinner_napkin_rustle', 'cue_dinner_throat_clear',
        'cue_dinner_water_pour', 'cue_dinner_wine_pour', 'cue_dinner_table_thump'
    ];
    const requiredMusicStems = ['amb_diner_rain_hum'];

    const voiceManifestPath = path.join(repoRoot, 'voices/voice_manifest.json');
    const foleyRegistryPath = path.join(repoRoot, 'foley/registry.json');
    const musicManifestPath = path.join(repoRoot, 'music/manifest.json');

    let voicesData: any = { voices: {} };
    let foleyData: any = { cues: {} };
    let musicData: any = { stems: {} };

    try {
        if (fs.existsSync(voiceManifestPath)) voicesData = JSON.parse(fs.readFileSync(voiceManifestPath, 'utf8'));
        if (fs.existsSync(foleyRegistryPath)) foleyData = JSON.parse(fs.readFileSync(foleyRegistryPath, 'utf8'));
        if (fs.existsSync(musicManifestPath)) musicData = JSON.parse(fs.readFileSync(musicManifestPath, 'utf8'));
    } catch(e) {}

    const missing: string[] = [];

    for (const char of requiredCharacters) {
        if (!voicesData.voices || !voicesData.voices[char]) missing.push(char);
    }
    for (const cue of requiredFoleyCues) {
        if (!foleyData.cues || !foleyData.cues[cue]) missing.push(cue);
    }
    for (const stem of requiredMusicStems) {
        if (!musicData.stems || !musicData.stems[stem]) missing.push(stem);
    }

    if (missing.length > 0) {
        throw new Error(`LORE_ASSET_PARITY_BREACH: ${missing.join(', ')}`);
    }
}
