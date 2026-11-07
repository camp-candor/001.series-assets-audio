import { Hono } from 'hono';
import { Env } from '../types/env';
import { getTotalStorageBytesUsed, getAssetBySha256, insertAssetRecord } from '../db/assetLedger';
import { verifyEdgeRedactionCompliance } from '../redaction';

const uploadRoutes = new Hono<{ Bindings: Env }>();

uploadRoutes.post('/api/v1/assets/upload-intent', async (c) => {
  const env = c.env;
  const body = await c.req.json();
  const { byteSize, candidateByteSize, legalClearanceToken, sha256, characterSlug, requestedVersion, holderId } = body;

  if (!characterSlug) {
    return c.json({ error: 'BAD_REQUEST' }, 400);
  }

  const size = candidateByteSize || byteSize;

  const totalBytes = await getTotalStorageBytesUsed(env.DB);
  if (totalBytes + size > 10_200_547_328) {
    return c.json({ error: 'R2_QUOTA_CEILING_BREACH' }, 507);
  }

  if (!legalClearanceToken || !/^CLR-[A-Z0-9]{4,12}-\d{4}$/.test(legalClearanceToken)) {
    return c.json({ error: 'INVALID_LEGAL_CLEARANCE' }, 422);
  }

  const existing = await getAssetBySha256(env.DB, sha256);
  if (existing) {
    return c.json({ error: 'DUPLICATE_ASSET', asset: existing }, 409);
  }

  const id = env.AUDIO_LEASE_DO.idFromName(characterSlug);
  const doObj = env.AUDIO_LEASE_DO.get(id);
  const resp = await doObj.fetch(new Request('http://do/acquire', {
    method: 'POST',
    body: JSON.stringify({ holderId, requestedVersion, nowMs: Date.now() }),
    headers: { 'Content-Type': 'application/json' }
  }));

  const result = await resp.json();
  if (!result.granted) {
    return c.json(result, result.httpStatus);
  }

  return c.json({ intent: 'granted' });
});

uploadRoutes.put('/api/v1/assets/commit', async (c) => {
  const env = c.env;
  const body = await c.req.json();
  const { assetRecord, holderId, metadata } = body;

  if (!assetRecord || !assetRecord.character_or_cue_slug) {
    return c.json({ error: 'BAD_REQUEST' }, 400);
  }

  if (metadata) {
    if (!verifyEdgeRedactionCompliance(metadata)) {
      return c.json({ error: 'INVALID_REDACTION' }, 400);
    }
  }

  const r2Obj = await env.AUDIO_VAULT_BUCKET.head(assetRecord.r2_object_key);
  if (!r2Obj) {
    return c.json({ error: 'ASSET_NOT_FOUND_IN_R2' }, 404);
  }

  const id = env.AUDIO_LEASE_DO.idFromName(assetRecord.character_or_cue_slug);
  const doObj = env.AUDIO_LEASE_DO.get(id);
  const resp = await doObj.fetch(new Request('http://do/commit', {
    method: 'POST',
    body: JSON.stringify({ holderId, versionNumber: assetRecord.version_number, nowMs: Date.now() }),
    headers: { 'Content-Type': 'application/json' }
  }));

  const result = await resp.json();
  if (!result.committed) {
    return c.json(result, result.httpStatus);
  }

  await insertAssetRecord(env.DB, assetRecord);

  return c.json({ committed: true });
});

uploadRoutes.get('/api/v1/assets/manifest', async (c) => {
  return c.json({ manifest: [] });
});

uploadRoutes.get('/api/v1/assets/lockfile', async (c) => {
  return c.json({ lockfile: {} });
});

export { uploadRoutes };
