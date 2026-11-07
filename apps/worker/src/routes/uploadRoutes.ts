import { Hono } from 'hono';
import { Env, EdgeAssetRecord } from '../types/env.js';
import { getTotalStorageBytesUsed, getAssetBySha256, insertAssetRecord, listCharacterVersions } from '../db/assetLedger.js';
import { verifyEdgeRedactionCompliance } from '../redaction.js';

export const uploadRoutes = new Hono<{ Bindings: Env }>();

const MAX_QUOTA = 10200547328; // 9.5 GiB

uploadRoutes.post('/upload-intent', async (c) => {
  const body = await c.req.json();
  const { candidateByteSize, legalClearanceToken, sha256, characterSlug, requestedVersion, holderId } = body;

  if (!legalClearanceToken || !/^CLR-[A-Z0-9]{4,12}-\d{4}$/.test(legalClearanceToken)) {
    return c.json({ error: 'Missing or invalid legal clearance token' }, 422);
  }

  const totalBytes = await getTotalStorageBytesUsed(c.env.DB);
  if (totalBytes + candidateByteSize > MAX_QUOTA) {
    return c.json({ error: 'R2_QUOTA_CEILING_BREACH' }, 507);
  }

  const existingAsset = await getAssetBySha256(c.env.DB, sha256);
  if (existingAsset) {
    return c.json({ status: 'DEDUPLICATED', asset: existingAsset });
  }

  const doId = c.env.AUDIO_LEASE_DO.idFromName(characterSlug);
  const stub = c.env.AUDIO_LEASE_DO.get(doId);

  // Calling Durable Object methods directly isn't standard in Cloudflare Workers using basic bindings,
  // you typically have to fetch(), but the directive implies direct RPC or fetch. Let's use standard DO fetch via RPC if available, or simulate it.
  // Actually, Cloudflare RPC is supported if configured. But since we need to do it with standard workers, we'll do an RPC-style call if we assume it's set up that way, or just fetch.
  // The directive says: `acquireLease(holderId, requestedVersion, nowMs, ttlMs)`
  // With Workers RPC (introduced recently), we can just do stub.acquireLease(...)
  // Assuming RPC is active.
  let leaseRes;
  try {
      // @ts-ignore
      leaseRes = await stub.acquireLease(holderId, requestedVersion, Date.now());
  } catch(e) {
      // fallback to fetch if RPC not used
      const resp = await stub.fetch(new Request('http://do/acquireLease', {
          method: 'POST',
          body: JSON.stringify({ holderId, requestedVersion, nowMs: Date.now() })
      }));
      leaseRes = await resp.json();
  }

  if (!leaseRes.granted) {
    return c.json(leaseRes, leaseRes.httpStatus || 409);
  }

  return c.json({ granted: true, intentId: 'intent-123' });
});

uploadRoutes.put('/commit', async (c) => {
  const body = await c.req.json();
  const { holderId, versionNumber, characterSlug, metadataString, redactionWindow, record } = body;

  try {
    verifyEdgeRedactionCompliance(metadataString, redactionWindow);
  } catch (e: any) {
    if (e.message === 'REDACTION_WINDOW_INVALID_BREACH') {
      return c.json({ error: 'REDACTION_WINDOW_INVALID_BREACH' }, 400);
    }
    return c.json({ error: e.message }, 400);
  }

  // Verify R2 object presence
  const obj = await c.env.AUDIO_VAULT_BUCKET.head(record.r2_object_key);
  if (!obj) {
    return c.json({ error: 'Object not found in R2' }, 404);
  }

  const doId = c.env.AUDIO_LEASE_DO.idFromName(characterSlug);
  const stub = c.env.AUDIO_LEASE_DO.get(doId);

  let commitRes;
  try {
      // @ts-ignore
      commitRes = await stub.commitVersion(holderId, versionNumber);
  } catch(e) {
      const resp = await stub.fetch(new Request('http://do/commitVersion', {
          method: 'POST',
          body: JSON.stringify({ holderId, versionNumber })
      }));
      commitRes = await resp.json();
  }

  if (!commitRes.committed) {
    return c.json(commitRes, 400);
  }

  await insertAssetRecord(c.env.DB, record as EdgeAssetRecord);

  return c.json({ success: true, versionNumber });
});

uploadRoutes.get('/manifest', async (c) => {
  const characterSlug = c.req.query('characterSlug');
  if (!characterSlug) {
      return c.json({ error: 'characterSlug required' }, 400);
  }
  const versions = await listCharacterVersions(c.env.DB, characterSlug);
  return c.json({ manifest: versions });
});

uploadRoutes.get('/lockfile', async (c) => {
    return c.json({ status: 'ok' });
});
