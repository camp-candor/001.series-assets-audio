export const INIT_SYNC = '[Sync action] Init Sync';
export class InitSync {
    readonly type = INIT_SYNC;
    constructor(public payload: any) {}
}
export type Actions = InitSync;\n