export function calculateVersionBumpBlastRadius(changedAssetIds: string[], sceneAstList: Array<{ scene_id: string; dialogue_lines: Array<{ line_id: string; speaker_id: string; foley_cues?: string[]; ambient_stem?: string }> }>) {
    return { invalidatedSceneIds: [], invalidatedLineIds: [] };
}\n