import { D1Database } from '@cloudflare/workers-types';
import { EdgeAssetRecord } from '../types/env.js';

export async function getTotalStorageBytesUsed(db: D1Database): Promise<number> {
  const result = await db.prepare(
    `SELECT COALESCE(SUM(byte_size), 0) AS total_bytes FROM audio_assets`
  ).first();
  return (result?.total_bytes as number) || 0;
}

export async function getAssetBySha256(db: D1Database, sha256: string): Promise<EdgeAssetRecord | null> {
  const result = await db.prepare(
    `SELECT * FROM audio_assets WHERE sha256 = ?`
  ).bind(sha256).first();
  return (result as unknown as EdgeAssetRecord) || null;
}

export async function listCharacterVersions(db: D1Database, characterSlug: string): Promise<EdgeAssetRecord[]> {
  const { results } = await db.prepare(
    `SELECT * FROM audio_assets WHERE character_or_cue_slug = ? ORDER BY version_number DESC`
  ).bind(characterSlug).all();
  return results as unknown as EdgeAssetRecord[];
}

export async function insertAssetRecord(db: D1Database, record: EdgeAssetRecord): Promise<void> {
  if (record.sample_rate_hz !== 48000) {
    throw new Error('Invalid sample_rate_hz');
  }
  if (record.bit_depth !== 24) {
    throw new Error('Invalid bit_depth');
  }
  if (!/^CLR-[A-Z0-9]{4,12}-\d{4}$/.test(record.legal_clearance_token)) {
    throw new Error('Invalid legal_clearance_token');
  }

  await db.prepare(`
    INSERT INTO audio_assets (
      asset_id,
      domain,
      character_or_cue_slug,
      version_number,
      sha256,
      byte_size,
      sample_rate_hz,
      bit_depth,
      legal_clearance_token,
      r2_object_key,
      created_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.asset_id,
    record.domain,
    record.character_or_cue_slug,
    record.version_number,
    record.sha256,
    record.byte_size,
    record.sample_rate_hz,
    record.bit_depth,
    record.legal_clearance_token,
    record.r2_object_key,
    record.created_at_iso
  ).run();
}
