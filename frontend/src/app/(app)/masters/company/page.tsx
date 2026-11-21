import type { Metadata } from "next";
import { CompanySetupScreen } from "@/features/company/company-setup-screen";

export const metadata: Metadata = { title: "Company & GST setup" };

export default function CompanySetupPage() {
  return <CompanySetupScreen />;
}
