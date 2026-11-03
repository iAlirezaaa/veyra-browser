/** Shared, testable appearance logic for new tab and popup. No network or trackers. */
export const MODES = ['system', 'light', 'dark'];
export function normalizeTheme(value) {
  return MODES.includes(value) ? value : 'system';
}
export function resolveTheme(mode, systemDark = false) {
  const normalized = normalizeTheme(mode);
  return normalized === 'system' ? (systemDark ? 'dark' : 'light') : normalized;
}
export function applyTheme(mode, { doc = document, systemDark = false } = {}) {
  const choice = normalizeTheme(mode);
  const effective = resolveTheme(choice, systemDark);
  doc.documentElement.dataset.theme = effective;
  doc.documentElement.style.colorScheme = effective;
  if (doc.body) doc.body.dataset.theme = choice;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective === 'dark' ? '#11161d' : '#f7f8fa');
  return effective;
}
