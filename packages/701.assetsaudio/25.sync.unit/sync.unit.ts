import { SyncModel } from './sync.model.js';
import * as reduceFromSync from './sync.reduce.js';
import * as syncBuzzer from './sync.buzzer.js';

export default {
    model: new SyncModel(),
    reducer: reduceFromSync.reducer,
    buzzer: syncBuzzer,
};\n