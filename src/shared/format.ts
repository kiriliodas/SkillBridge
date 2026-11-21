/**
 * Human-readable formatting helpers shared by the UI and the tests.
 */

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  const fixed = idx === 0 ? Math.round(value).toString() : value.toFixed(decimals);
  return `${fixed} ${units[idx]}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

export function truncateMiddle(text: string, max = 48): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(text.length - half)}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const delta = Math.max(0, now - timestamp);
  const seconds = Math.round(delta / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}
