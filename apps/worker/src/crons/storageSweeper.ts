import { Env } from '../types/env.js';

export async function runScheduledStorageSweeper(env: Env) {
  const STAGING_PREFIX = 'staging/';
  const STAGING_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const nowMs = Date.now();

  let truncated = false;
  let cursor: string | undefined = undefined;

  do {
    const listResponse = await env.AUDIO_VAULT_BUCKET.list({
      prefix: STAGING_PREFIX,
      cursor: cursor,
    });

    for (const object of listResponse.objects) {
      // Exclude committed keys just in case they matched prefix somehow (though they shouldn't)
      if (object.key.startsWith('voices/versions/') ||
          object.key.startsWith('foley/') ||
          object.key.startsWith('music/')) {
        continue;
      }

      const uploadedAtMs = object.uploaded.getTime();
      if (nowMs - uploadedAtMs > STAGING_TTL_MS) {
        await env.AUDIO_VAULT_BUCKET.delete(object.key);
      }
    }

    truncated = listResponse.truncated;
    cursor = listResponse.truncated ? listResponse.cursor : undefined;
  } while (truncated);
}
