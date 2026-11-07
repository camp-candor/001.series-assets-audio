export async function runScheduledStorageSweeper(event: any, env: any) {
  const cutoff = Date.now() - 3600000;
  let cursor;
  do {
    const list = await env.AUDIO_VAULT_BUCKET.list({ prefix: 'staging/', cursor });
    for (const obj of list.objects) {
      if (obj.uploaded.getTime() < cutoff) {
        await env.AUDIO_VAULT_BUCKET.delete(obj.key);
      }
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}
