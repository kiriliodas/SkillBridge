import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256, sha256Bytes, utf8ByteLength, utf8Bytes, shortHash } from '../src/core/hash';

const nodeSha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('sha256', () => {
  it('matches Node crypto for known vectors', () => {
    expect(sha256('')).toBe(nodeSha(''));
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    );
  });

  it('matches Node crypto across lengths that exercise padding boundaries', () => {
    for (const len of [0, 1, 55, 56, 63, 64, 65, 127, 128, 1000]) {
      const text = 'x'.repeat(len);
      expect(sha256(text)).toBe(nodeSha(text));
    }
  });

  it('handles unicode content identically to Node (UTF-8 bytes)', () => {
    const text = 'Réseau — 日本語 🚀\nline2\n';
    expect(sha256(text)).toBe(nodeSha(text));
    expect(sha256Bytes(utf8Bytes(text))).toBe(nodeSha(text));
  });

  it('hashes raw bytes', () => {
    const bytes = new TextEncoder().encode('SkillBridge');
    expect(sha256Bytes(bytes)).toBe(nodeSha('SkillBridge'));
  });

  it('computes UTF-8 byte length, not UTF-16 length', () => {
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('日本')).toBe(6);
    expect(utf8ByteLength('a')).toBe(1);
  });

  it('produces short hashes', () => {
    expect(shortHash('abc', 4)).toHaveLength(4);
    expect(nodeSha('abc').startsWith(shortHash('abc', 4))).toBe(true);
  });
});
