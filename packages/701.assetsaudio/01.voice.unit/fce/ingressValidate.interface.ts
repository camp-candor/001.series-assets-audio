export interface InodeValidationResult {
    filePath: string
    absolutePath: string
    exists: boolean
    isReadable: boolean
    isFile: boolean
    byteSize: number
    extension: string
    status: 'VALID' | 'INVALID'
    error?: string
}
