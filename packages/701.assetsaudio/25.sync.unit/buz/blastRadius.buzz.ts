export function calculateVersionBumpBlastRadius(
    changedAssetIds: string[],
    sceneAstList: Array<{
        scene_id: string
        dialogue_lines: Array<{
            line_id: string
            speaker_id: string
            foley_cues?: string[]
            ambient_stem?: string
        }>
    }>,
): { invalidatedSceneIds: string[]; invalidatedLineIds: string[] } {
    const invalidatedSceneIds = new Set<string>()
    const invalidatedLineIds = new Set<string>()

    for (const scene of sceneAstList) {
        let sceneInvalidated = false

        for (const line of scene.dialogue_lines) {
            let lineInvalidated = false

            if (changedAssetIds.includes(line.speaker_id)) {
                lineInvalidated = true
            }
            if (
                line.foley_cues &&
                line.foley_cues.some((cue) => changedAssetIds.includes(cue))
            ) {
                lineInvalidated = true
            }
            if (
                line.ambient_stem &&
                changedAssetIds.includes(line.ambient_stem)
            ) {
                lineInvalidated = true
            }

            if (lineInvalidated) {
                invalidatedLineIds.add(line.line_id)
                sceneInvalidated = true
            }
        }

        if (sceneInvalidated) {
            invalidatedSceneIds.add(scene.scene_id)
        }
    }

    return {
        invalidatedSceneIds: Array.from(invalidatedSceneIds),
        invalidatedLineIds: Array.from(invalidatedLineIds),
    }
}
