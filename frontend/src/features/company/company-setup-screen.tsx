"use client";

import { LoadNotice } from "@/components/ui/load-notice";
import { GstDecisionTable } from "@/features/gst/gst-decision-table";
import { saveCompanyProfile, toCompanyValues } from "./company-profile-api";
import { CompanyProfileForm } from "./company-profile-form";
import { useCompanyProfile } from "./use-company-profile";

// Company & GST setup: the company profile is stored; the decision table
// shows the fixed GST rules for our registration.
export function CompanySetupScreen() {
  const { profile, error, mutate } = useCompanyProfile();
  if (!profile) return <LoadNotice error={error} what="the company profile" />;
  return (
    <>
      <CompanyProfileForm
        initial={toCompanyValues(profile)}
        onSave={async (values) => {
          const saved = await saveCompanyProfile(values);
          await mutate(saved, { revalidate: false });
          return toCompanyValues(saved);
        }}
      />
      <GstDecisionTable company={profile} />
    </>
  );
}
