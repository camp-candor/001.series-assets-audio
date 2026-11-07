import { describe, it, expect, beforeEach } from 'vitest';
import { AudioLeaseDO } from '../../src/durable_objects/AudioLeaseDO';
import { verifyEdgeRedactionCompliance } from '../../src/redaction';
import { Hono } from 'hono';
import { uploadRoutes } from '../../src/routes/uploadRoutes';
import { insertAssetRecord, getAssetBySha256, getTotalStorageBytesUsed } from '../../src/db/assetLedger';

describe('AudioLeaseDO', () => {
  let storageState: any;

  beforeEach(() => {
    let data: any = {};
    storageState = {
      storage: {
        get: async (k: string) => data[k],
        put: async (k: string, v: any) => { data[k] = v; },
        delete: async (k: string) => { delete data[k]; }
      },
      blockConcurrencyWhile: async (cb: any) => await cb()
    };
  });

  it('acquires lease successfully', async () => {
    const doObj = new AudioLeaseDO(storageState);
    await doObj.state.blockConcurrencyWhile(async () => {});

    const res = await doObj.acquireLease('holder1', 1, 1000);
    expect(res.granted).toBe(true);
    expect(res.statusCode).toBe('LEASE_ACQUIRED');
  });

  it('rejects concurrent lease (LEASE_CONFLICT_BREACH)', async () => {
    const doObj = new AudioLeaseDO(storageState);
    await doObj.state.blockConcurrencyWhile(async () => {});
    await doObj.acquireLease('holder1', 1, 1000, 5000);

    const res = await doObj.acquireLease('holder2', 1, 2000, 5000);
    expect(res.granted).toBe(false);
    expect(res.statusCode).toBe('LEASE_CONFLICT_BREACH');
    expect(res.httpStatus).toBe(409);
  });

  it('rejects version skip (MONOTONIC_REGRESSION_BREACH)', async () => {
    const doObj = new AudioLeaseDO(storageState);
    await doObj.state.blockConcurrencyWhile(async () => {});

    const res = await doObj.acquireLease('holder1', 2, 1000, 5000);
    expect(res.granted).toBe(false);
    expect(res.statusCode).toBe('MONOTONIC_REGRESSION_BREACH');
    expect(res.httpStatus).toBe(409);
  });
});

describe('redaction', () => {
  it('validates good redaction', () => {
    const md = JSON.stringify({ redaction_window: { start_ms: 100, end_ms: 200 } });
    expect(verifyEdgeRedactionCompliance(md)).toBe(true);
  });

  it('rejects invalid redaction window', () => {
    const md = JSON.stringify({ redaction_window: { start_ms: 200, end_ms: 100 } });
    expect(verifyEdgeRedactionCompliance(md)).toBe(false);
  });

  it('rejects non-ascii', () => {
    const md = 'Hello world 😊';
    expect(verifyEdgeRedactionCompliance(md)).toBe(false);
  });

  it('rejects invalid JSON', () => {
    const md = '{"redaction_window": { "start_ms": 100, ';
    expect(verifyEdgeRedactionCompliance(md)).toBe(false);
  });
});

describe('uploadRoutes and assetLedger', () => {
  let env: any;
  let dbRecords: any[];

  beforeEach(() => {
    dbRecords = [];
    env = {
      DB: {
        prepare: (query: string) => {
          return {
            bind: (...args: any[]) => {
              return {
                first: async () => {
                  if (query.includes('SUM(byte_size)')) return { total_bytes: 1000 };
                  if (query.includes('sha256 = ?')) return dbRecords.find(r => r.sha256 === args[0]) || null;
                  return null;
                },
                run: async () => {
                  dbRecords.push({
                    asset_id: args[0], domain: args[1], character_or_cue_slug: args[2],
                    version_number: args[3], sha256: args[4], byte_size: args[5],
                    sample_rate_hz: args[6], bit_depth: args[7], legal_clearance_token: args[8],
                    r2_object_key: args[9], created_at_iso: args[10]
                  });
                },
                all: async () => {
                  return { results: dbRecords.filter(r => r.character_or_cue_slug === args[0]) };
                }
              }
            },
            first: async () => {
              if (query.includes('SUM(byte_size)')) return { total_bytes: 1000 };
              return null;
            }
          }
        }
      },
      AUDIO_LEASE_DO: {
        idFromName: () => 'id1',
        get: () => ({
          fetch: async () => new Response(JSON.stringify({ granted: true, statusCode: 'LEASE_ACQUIRED', httpStatus: 200 }))
        })
      }
    };
  });

  it('upload intent succeeds', async () => {
    const res = await uploadRoutes.fetch(new Request('http://localhost/api/v1/assets/upload-intent', {
      method: 'POST',
      body: JSON.stringify({
        candidateByteSize: 1000,
        legalClearanceToken: 'CLR-ABCD123-2024',
        sha256: 'xyz',
        characterSlug: 'char1',
        requestedVersion: 1,
        holderId: 'holder1'
      }),
      headers: { 'Content-Type': 'application/json' }
    }), env);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.intent).toBe('granted');
  });

  it('upload intent rejects R2_QUOTA_CEILING_BREACH', async () => {
    const res = await uploadRoutes.fetch(new Request('http://localhost/api/v1/assets/upload-intent', {
      method: 'POST',
      body: JSON.stringify({
        candidateByteSize: 10_200_547_328 + 1,
        legalClearanceToken: 'CLR-ABCD123-2024',
        sha256: 'xyz',
        characterSlug: 'char1',
        requestedVersion: 1,
        holderId: 'holder1'
      }),
      headers: { 'Content-Type': 'application/json' }
    }), env);
    expect(res.status).toBe(507);
    const json = await res.json() as any;
    expect(json.error).toBe('R2_QUOTA_CEILING_BREACH');
  });

  it('upload intent rejects invalid legal clearance', async () => {
    const res = await uploadRoutes.fetch(new Request('http://localhost/api/v1/assets/upload-intent', {
      method: 'POST',
      body: JSON.stringify({
        candidateByteSize: 1000,
        legalClearanceToken: 'INVALID',
        sha256: 'xyz',
        characterSlug: 'char1',
        requestedVersion: 1,
        holderId: 'holder1'
      }),
      headers: { 'Content-Type': 'application/json' }
    }), env);
    expect(res.status).toBe(422);
  });

  it('upload intent rejects missing slug', async () => {
    const res = await uploadRoutes.fetch(new Request('http://localhost/api/v1/assets/upload-intent', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    }), env);
    expect(res.status).toBe(400);
  });
});
