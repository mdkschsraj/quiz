// Admission types offered on the registration form. Stored as the value, shown as the label.
export const ADMISSION_TYPES = [
  { value: "medical", label: "Medical" },
  { value: "nursing", label: "Nursing" },
  { value: "a_unit", label: "A Unit" },
  { value: "other_unit", label: "Other Unit" },
] as const;

export type AdmissionType = (typeof ADMISSION_TYPES)[number]["value"];

export function parseAdmission(v: unknown): AdmissionType | null {
  return ADMISSION_TYPES.find((t) => t.value === v)?.value ?? null;
}

export function admissionLabel(v: string | null | undefined): string {
  return ADMISSION_TYPES.find((t) => t.value === v)?.label ?? "Not given";
}
