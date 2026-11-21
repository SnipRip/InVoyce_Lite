// Calls for our own company profile, and the conversion to the form's
// values. The backend turns blank text into null, so the form is sent as is.
import { apiRequest } from "@/lib/api-client";
import type { CompanyProfileView } from "@/types/company";
import type { CompanyProfileValues } from "./company-profile-schema";

export const COMPANY_PROFILE_PATH = "/company-profile";

export const toCompanyValues = (view: CompanyProfileView): CompanyProfileValues => ({
  legalName: view.legalName,
  registration: view.registration,
  stateCode: view.stateCode,
  enforceHsnGstRate: view.enforceHsnGstRate,
  tradeName: view.tradeName ?? "",
  gstin: view.gstin ?? "",
  pan: view.pan ?? "",
  addressLine: view.addressLine ?? "",
  city: view.city ?? "",
  district: view.district ?? "",
  pin: view.pin ?? "",
  phone: view.phone ?? "",
  altPhone: view.altPhone ?? "",
  email: view.email ?? "",
});

export const saveCompanyProfile = (values: CompanyProfileValues) =>
  apiRequest<CompanyProfileView>(COMPANY_PROFILE_PATH, { method: "PATCH", body: values });
