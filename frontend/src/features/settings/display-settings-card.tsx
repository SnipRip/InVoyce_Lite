"use client";

import { ZoomStepper } from "@/components/layout/zoom-control";
import { CardTitle, GlassCard } from "@/components/ui/glass-card";

// The user's own zoom for the dashboard, kept in this browser only (each
// person and each device sets their own).
export function DisplaySettingsCard() {
  return (
    <GlassCard aria-labelledby="settings-display" className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-0.5">
        <CardTitle id="settings-display">Display</CardTitle>
        <p className="text-xs text-muted">How large the dashboard looks on this device. Saved in this browser; other devices keep their own.</p>
      </div>
      <ZoomStepper />
    </GlassCard>
  );
}
