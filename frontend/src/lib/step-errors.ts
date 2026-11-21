// Stepped forms (VoucherSteps): which step holds a field that failed
// validation, so a failed save opens it and marks it red.

type Errors = Partial<Record<string, unknown>>;

/** True when any of the fields has an error. */
export const stepHasErrors = (errors: Errors, fields: readonly string[]) => fields.some((field) => Boolean(errors[field]));

/** The first step with an error (index into `stepFields`), else the last step. */
export function firstStepWithErrors(errors: Errors, stepFields: readonly (readonly string[])[]): number {
  const index = stepFields.findIndex((fields) => stepHasErrors(errors, fields));
  return index === -1 ? stepFields.length - 1 : index;
}
