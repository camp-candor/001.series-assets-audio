import * as fs from 'fs-extra';
import * as path from 'path';

export function auditDialogueLexiconCoverage(repoRoot: string, dialogueLines: string[]) {
    const mandatoryTerms = ['Mayhaw', 'Okefenokee', 'astigmatism', 'Phoropter'];

    const lexiconPath = path.join(repoRoot, 'voices/lexicon.json');
    let lexiconData: any = { entries: {} };

    try {
        if (fs.existsSync(lexiconPath)) lexiconData = JSON.parse(fs.readFileSync(lexiconPath, 'utf8'));
    } catch(e) {}

    const missingEntries = new Set<string>();

    for (const line of dialogueLines) {
        for (const term of mandatoryTerms) {
            // Simple case-insensitive matching
            const regex = new RegExp(`\\b${term}\\b`, 'i');
            if (regex.test(line)) {
                // Find case-insensitive key in lexicon
                const lexiconKeys = Object.keys(lexiconData.entries || {});
                const found = lexiconKeys.some(k => k.toLowerCase() === term.toLowerCase());
                if (!found) {
                    missingEntries.add(term);
                }
            }
        }
    }

    if (missingEntries.size > 0) {
        throw new Error(`LEXICON_COVERAGE_MISSING_BREACH: ${Array.from(missingEntries).join(', ')}`);
    }
}
