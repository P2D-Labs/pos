/** Applies Settings “theme color” to global CSS variables (primary buttons + Till accent). */
export function applyThemePrimaryCss(hex: string) {
  document.documentElement.style.setProperty("--danger", hex);
  document.documentElement.style.setProperty("--theme-primary", hex);
}
