import fs from 'fs-extra'
import path from 'path'
import type { TwoTierPromotionPayload } from '../fce/inodeRelocation.interface.js'

export const appendVersionChangelog = async (
    changelogPath: string,
    payload: TwoTierPromotionPayload,
    sha256: string,
): Promise<boolean> => {
    await fs.ensureDir(path.dirname(changelogPath))

    const isoTime = new Date().toISOString()
    const versionTag = `v${payload.targetVersionNumber}`
    const condStr = payload.conditionTag ? ` [${payload.conditionTag}]` : ''

    const entry = [
        `### [${versionTag}] - ${payload.characterSlug}${condStr} - ${isoTime}`,
        `- **Operator**: ${payload.operatorId}`,
        `- **SHA-256**: \`${sha256}\``,
        `- **Technical Metrics**:`,
        `  - Integrated Loudness: ${payload.technicalMetrics.lufs} LUFS`,
        `  - True-Peak: ${payload.technicalMetrics.peakDbtp} dBTP`,
        `  - Sample Rate: ${payload.technicalMetrics.sampleRate} Hz (${payload.technicalMetrics.channels} ch)`,
        payload.qualitativeNotes
            ? `- **Notes**: ${payload.qualitativeNotes}`
            : '',
        '',
        '---',
        '',
    ]
        .filter((line) => line !== '')
        .join('\n')

    if (await fs.pathExists(changelogPath)) {
        await fs.appendFile(changelogPath, `\n${entry}\n`, 'utf8')
    } else {
        const header =
            '# Audio Asset Vault Revision Changelog\n\nAll modifications are append-only.\n\n---\n\n'
        await fs.writeFile(changelogPath, `${header}${entry}\n`, 'utf8')
    }

    return true
}
