"use client";

import { useCallback, useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";
import { applyZoom, cleanZoom, DEFAULT_ZOOM, stepZoom, ZOOM_STORAGE_KEY } from "./display-zoom";

const readStored = (): unknown => {
  try {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    return raw === null ? DEFAULT_ZOOM : JSON.parse(raw);
  } catch {
    return DEFAULT_ZOOM;
  }
};

// The user's dashboard zoom, remembered in this browser. Every component using
// it stays in step (usehooks-ts shares the key between hooks and tabs).
export function useDisplayZoom() {
  const [stored, setStored] = useLocalStorage<number>(ZOOM_STORAGE_KEY, DEFAULT_ZOOM, { initializeWithValue: false });
  const zoom = cleanZoom(stored);
  // The first render holds the default until storage is read, while the boot
  // script in <head> has already applied the saved zoom: apply only a value
  // that storage agrees with, so that render never undoes it.
  useEffect(() => {
    if (cleanZoom(readStored()) === zoom) applyZoom(zoom);
  }, [zoom]);

  const setZoom = useCallback((next: number) => setStored(cleanZoom(next)), [setStored]);
  const zoomIn = useCallback(() => setStored((current) => stepZoom(cleanZoom(current), 1)), [setStored]);
  const zoomOut = useCallback(() => setStored((current) => stepZoom(cleanZoom(current), -1)), [setStored]);
  const reset = useCallback(() => setStored(DEFAULT_ZOOM), [setStored]);

  return { zoom, setZoom, zoomIn, zoomOut, reset };
}
