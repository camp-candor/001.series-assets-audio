export interface MusicScaffoldResult {
    musicRoot: string
    ambientDir: string
    scoreDir: string
    manifestPath: string
    createdDirs: string[]
}

export default interface MusicBit<TDat = unknown, TLst = string> {
    idx: string
    src?: string
    lst?: TLst[]
    val?: number
    dat?: TDat
    slv?: (result: { musicBit: Partial<MusicBit<TDat, TLst>> }) => void
}
