import { cloneDeep } from 'lodash-es';
import { SyncModel } from './sync.model.js';
import * as Act from './sync.action.js';

export function reducer(model: SyncModel = new SyncModel(), act: Act.Actions, state?: any) {
    switch (act.type) {
        case Act.INIT_SYNC:
            return cloneDeep(model);
        default:
            return model;
    }
}\n