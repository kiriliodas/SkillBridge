import { App } from './App';

/**
 * Full-page library manager. Reuses the same App component as the popup with a
 * different surface flag: identical behaviour and state, roomier layout
 * (side-by-side tree and preview) and the Library/Settings navigation.
 */
export function Manager() {
  return <App surface="manager" />;
}
