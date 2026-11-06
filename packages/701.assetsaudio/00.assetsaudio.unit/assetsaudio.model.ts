import type AssetsAudio from './fce/assetsaudio.interface.js';

export class AssetsAudioModel implements AssetsAudio {
  idx = '00.assetsaudio';
  vaultRoot = process.cwd();
  lfsInitialized = false;
  totalVaultBytes = 0;
  trackedMediaFiles = 0;
}

export default AssetsAudioModel;
