export default interface FoleyBit<TDat = unknown, TLst = string> {
    idx: string
    src?: string
    lst?: TLst[]
    val?: number
    dat?: TDat
    slv?: (result: { foleyBit: Partial<FoleyBit<TDat, TLst>> }) => void
}
