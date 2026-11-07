import * as fs from 'fs-extra';
import * as path from 'path';

export function verifyScreenplayAstAudioPointers(
    repoRoot: string,
    ast: {
        dialogue_lines: Array<{ speaker_id: string; condition?: string; foley_cues?: string[]; ambient_stems?: string[] }>
    }
) {
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

    const unresolvable: string[] = [];

    for (const line of ast.dialogue_lines) {
        if (line.speaker_id && (!voicesData.voices || !voicesData.voices[line.speaker_id])) {
            unresolvable.push(line.speaker_id);
        }
        if (line.foley_cues) {
            for (const cue of line.foley_cues) {
                if (!foleyData.cues || !foleyData.cues[cue]) unresolvable.push(cue);
            }
        }
        if (line.ambient_stems) {
            for (const stem of line.ambient_stems) {
                if (!musicData.stems || !musicData.stems[stem]) unresolvable.push(stem);
            }
        }
    }

    if (unresolvable.length > 0) {
        throw new Error(`AST_DANGLING_AUDIO_POINTER_BREACH: ${unresolvable.join(', ')}`);
    }
}
