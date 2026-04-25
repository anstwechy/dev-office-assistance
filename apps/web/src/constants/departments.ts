/** Suggested dev departments (free text also allowed in API) */
export const DEV_DEPARTMENTS = [
  "Mobile",
  "Core platform",
  "DevOps / SRE",
  "Web",
  "Shared / tooling",
] as const;

/** Stored as department when an initiative or expense applies org-wide (not a single squad). */
export const ALL_DEPARTMENTS_LABEL = "All departments";

/** Datalist / dropdown options: org-wide first, then squad areas. */
export const DEV_DEPARTMENT_SUGGESTIONS: readonly string[] = [ALL_DEPARTMENTS_LABEL, ...DEV_DEPARTMENTS];
