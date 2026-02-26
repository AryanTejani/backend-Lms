import { randomBytes } from 'crypto';

/**
 * UUID Utilities
 * Preserves all functions from src/utils/uuid.ts
 */

/**
 * Generates a UUID v7 (time-ordered UUID)
 * Benefits: time-ordered, index-friendly, reduces B-tree page splits
 */
export function generateUuidV7(): string {
  const timestamp = BigInt(Date.now());
  const randomBits = randomBytes(10);

  const bytes = Buffer.alloc(16);

  // Write 48-bit timestamp (big-endian)
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  randomBits.copy(bytes, 6);

  // Set version to 7
  const byte6 = bytes[6];

  if (byte6 !== undefined) {
    bytes[6] = (byte6 & 0x0f) | 0x70;
  }

  // Set variant to RFC 4122
  const byte8 = bytes[8];

  if (byte8 !== undefined) {
    bytes[8] = (byte8 & 0x3f) | 0x80;
  }

  const hex = bytes.toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return uuidRegex.test(uuid);
}
