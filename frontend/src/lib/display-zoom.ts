// The dashboard's own zoom, chosen by each user and kept in this browser's
// local storage (client, 13 Nov 2026). Applied as CSS `zoom` on <html>, so
// every pixel size scales together; `--app-zoom` lets full-height layouts
// divide viewport units back out (a zoomed 100dvh would overflow).

export const ZOOM_STORAGE_KEY = "ivl.zoom";
export const DEFAULT_ZOOM = 1;
export const ZOOM_LEVELS = [0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.5] as const;

const MIN = ZOOM_LEVELS[0];
const MAX = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/** A stored value made safe: a number within the levels' range, else the default. */
export function cleanZoom(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(MAX, Math.max(MIN, value)) : DEFAULT_ZOOM;
}

/** The next level up (+1) or down (-1) from the current one. */
export function stepZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_LEVELS.find((level) => level > current + 0.001) ?? MAX;
  return [...ZOOM_LEVELS].reverse().find((level) => level < current - 0.001) ?? MIN;
}

export const zoomLabel = (zoom: number) => `${Math.round(zoom * 100)}%`;

export function applyZoom(zoom: number) {
  const root = document.documentElement;
  root.style.zoom = zoom === DEFAULT_ZOOM ? "" : String(zoom);
  root.style.setProperty("--app-zoom", String(zoom));
}

// Runs in <head> before the first paint, so a saved zoom never flashes at 100%.
// Kept tiny and self-contained: it cannot import anything.
export const ZOOM_BOOT_SCRIPT = `try{var z=JSON.parse(localStorage.getItem(${JSON.stringify(ZOOM_STORAGE_KEY)}));if(typeof z==="number"&&z>=${MIN}&&z<=${MAX}&&z!==1){var r=document.documentElement;r.style.zoom=String(z);r.style.setProperty("--app-zoom",String(z));}}catch(e){}`;
