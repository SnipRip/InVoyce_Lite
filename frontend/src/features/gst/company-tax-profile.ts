// SAMPLE, for the screens still on sample data (quotations, invoices,
// purchases, payments, reports, dashboard). The real profile is stored
// (backend /company-profile, features/company) and read by the GST & export
// setup screen and the Customers and Vendors screens; each sample screen moves
// to it when it is wired to the backend.
export const COMPANY_TAX_PROFILE = {
  legalName: "My Company",
  address: "Address line, City 700001, West Bengal",
  phone: "+91 98765 43210",
  email: "accounts@example.com",
  stateCode: "19",
  gstin: undefined as string | undefined,
  iec: undefined as string | undefined,
};
