import clone from 'clone-deep';
import * as Act from './voice.action.js';
import { VoiceModel } from './voice.model.js';
import * as Buzz from './voice.buzzer.js';

export function reducer(
  model: VoiceModel = new VoiceModel(),
  act: Act.Actions,
  state?: any,
) {
  switch (act.type) {
    case Act.INIT_VOICE:
      return Buzz.initVoice(clone(model, true), act.bale, state);

    case Act.SCAFFOLD_VAULT:
      return Buzz.scaffoldVault(clone(model, true), act.bale, state);

    case Act.SYNC_FLOATING_SYMLINKS:
      return Buzz.syncFloatingSymlinks(clone(model, true), act.bale, state);

    case Act.PROVISION_SERIES_PARTITION:
      return Buzz.provisionSeriesPartition(clone(model, true), act.bale, state);

    case Act.ASSERT_LIKENESS_QUARANTINE:
      return Buzz.assertLikenessQuarantine(clone(model, true), act.bale, state);

    case Act.VALIDATE_SOURCE_INODE:
      return Buzz.validateSourceInode(clone(model, true), act.bale, state);

    case Act.MATCH_EXISTING_CHARACTER:
      return Buzz.matchExistingCharacter(clone(model, true), act.bale, state);

    case Act.SCAFFOLD_NEW_CHARACTER:
      return Buzz.scaffoldNewCharacterProfile(clone(model, true), act.bale, state);

    case Act.RESOLVE_MONOTONIC_VERSION:
      return Buzz.resolveMonotonicVersion(clone(model, true), act.bale, state);

    case Act.CONFIGURE_VOICE_RECIPE:
      return Buzz.configureVoiceRecipe(clone(model, true), act.bale, state);

    case Act.COMMIT_RECIPE_TO_MANIFEST:
      return Buzz.commitRecipeToManifest(clone(model, true), act.bale, state);

    case Act.EXECUTE_TWO_TIER_PROMOTION:
      return Buzz.executeTwoTierPromotion(clone(model, true), act.bale, state);

    default:
      return model;
  }
}
