import type Voice from './fce/voice.interface.js';

export class VoiceModel implements Voice {
  idx = '01.voice';
  voicesRoot = process.cwd();
  activeVersionsCount = 0;
}

export default VoiceModel;
