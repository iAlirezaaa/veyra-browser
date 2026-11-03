/** Authenticate a Veyra new-tab page, including when Chrome reports its tab.
 * Content-script messages also carry the extension ID, so ID alone is NOT enough.
 */
export function isTrustedDashboardSender(sender, runtime) {
  if (!runtime?.id || sender?.id !== runtime.id || typeof runtime.getURL !== 'function') return false;
  const supplied = sender?.url || sender?.documentUrl || sender?.tab?.url;
  if (typeof supplied !== 'string') return false;
  try {
    const actual = new URL(supplied);
    const expected = new URL(runtime.getURL('src/ui/newtab.html'));
    return actual.origin === expected.origin && actual.pathname === expected.pathname;
  } catch {
    return false;
  }
}
