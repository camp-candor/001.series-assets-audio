import * as cloneDeep from 'clone-deep';
import * as act from './sync.action.js';
import { SyncModel } from './sync.model.js';
import * as buz from './sync.buzzer.js';

export function reducer(model: SyncModel = new SyncModel(), act: any, state?: any) {
    switch (act.type) {
        default:
            return model;
    }
}
