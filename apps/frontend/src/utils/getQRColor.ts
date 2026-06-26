import { debug } from '../appState';
import { type ApiMatter } from './backendShared';

/**
 * Get the QR code color based on the matter's state.
 * @param {ApiMatter | undefined} matter - The matter broadcast object.
 * @returns {string} 'red' if no pairing code or not online, 'var(--primary-color)' if not commissioned but has pairing codes,
 *          'var(--secondary-color)' if commissioned but no active sessions or subscriptions,
 *          'var(--div-text-color)' otherwise.
 */
export function getQRColor(matter: ApiMatter | undefined): string {
  if (debug) console.log(`getQRColor (id: ${matter?.id}) received matter:`, matter ?? 'undefined');
  if (matter === undefined) return 'red';
  if (!matter.online) return 'red';
  if (!matter.qrPairingCode && !matter.manualPairingCode && !matter.fabricInformations && !matter.sessionInformations) return 'red';
  if (!matter.commissioned && matter.qrPairingCode && matter.manualPairingCode) return 'var(--primary-color)';

  let sessions = 0;
  let subscriptions = 0;
  for (const session of matter.sessionInformations ?? []) {
    if (session.fabric && session.isPeerActive) sessions++;
    if (session.numberOfActiveSubscriptions > 0) subscriptions += session.numberOfActiveSubscriptions;
  }
  if (matter.commissioned && matter.fabricInformations && matter.sessionInformations && (sessions === 0 || subscriptions === 0)) return 'var(--secondary-color)';
  return 'var(--div-text-color)';
}
