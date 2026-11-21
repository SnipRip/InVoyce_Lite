"use client";

import { useEffect, useRef } from "react";

// A record made in a quick-add dialog is picked on the form only once the
// form's own list holds it (the lists reload through SWR and arrive on a
// later render), so every handler that looks the record up finds it. The
// check runs after every render of the form; closing the dialog is one.
export function usePickWhenListed<T>(listedIds: readonly string[], onPick: (id: string, context: T) => void) {
  const pending = useRef<{ id: string; context: T } | null>(null);
  const pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
    const waiting = pending.current;
    if (!waiting || !listedIds.includes(waiting.id)) return;
    pending.current = null;
    pick.current(waiting.id, waiting.context);
  });
  return (id: string, context: T) => {
    pending.current = { id, context };
  };
}
