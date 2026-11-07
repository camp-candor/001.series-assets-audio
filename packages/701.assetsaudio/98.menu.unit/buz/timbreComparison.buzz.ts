import * as fs from 'fs-extra';

export const compareVoiceTimbre = async (takeA: any, takeB: any) => {
    const report = `>> [TIMBRE:COMPARE] ${takeA.id} vs ${takeB.id}`;
    if (global.LIBRARY) {
        await global.LIBRARY.hunt('[Write action] Write Console', {
            idx: 'cns00',
            src: report,
        });
    }
};
