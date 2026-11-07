import type Music from './fce/music.interface.js'

export class MusicModel implements Music {
    idx = '03.music'
    musicRoot = process.cwd()
    stemsRegistered = 0
    stemsVerified = 0
    lastResolutionStatus = ''
    lastRegisteredStem = ''
}

export default MusicModel
