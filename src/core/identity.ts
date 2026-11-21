/**
 * Deterministic, human-readable package identifiers.
 *
 * A package id looks like: SB-20261121-4F2A9C1B
 *   SB        prefix
 *           date (UTC, YYYYMMDD)
 *           content fingerprint (first 8 hex chars of a SHA-256 over the
 *           sorted skill paths + content hashes)
 *
 * The same selection + same content compiled on a normalised date yields the
 * same id, which keeps compilation deterministic while still being unique
 * enough to be traceable.
 */
import { shortHash, sha256 } from './hash';

export interface PackageIdentity {
  packageId: string;
  packageName: string;
  fileName: string;
}

export function formatDateStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function createPackageIdentity(
  entries: { path: string; content: string }[],
  date: Date,
): PackageIdentity {
  const fingerprint = shortHash(
    entries
      .map((e) => `${e.path}:${sha256(e.content)}`)
      .sort()
      .join('|'),
    8,
  ).toUpperCase();
  const stamp = formatDateStamp(date);
  const packageId = `SB-${stamp}-${fingerprint}`;
  return {
    packageId,
    packageName: `SkillBridge Package ${stamp}`,
    fileName: `skillbridge-package-${fingerprint.toLowerCase()}.md`,
  };
}
