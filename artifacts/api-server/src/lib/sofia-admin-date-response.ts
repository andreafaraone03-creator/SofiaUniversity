type ParsedOrientationRequest = {
  appointmentDate: unknown;
};

type StoredOrientationRequest = {
  appointmentDate: string | null | undefined;
};

type ParsedEnrollment = {
  enrolledAt: unknown;
};

type StoredEnrollment = {
  enrolledAt: string | null | undefined;
};

export function preserveAppointmentDateOnlyStrings<
  T extends ParsedOrientationRequest,
>(
  validated: readonly T[],
  storedRows: readonly StoredOrientationRequest[],
): Array<Omit<T, "appointmentDate"> & { appointmentDate: string | null }> {
  return validated.map((request, index) => ({
    ...request,
    // Zod coerces OpenAPI date fields to Date; restore the stored date-only
    // value so JSON serialization preserves YYYY-MM-DD.
    appointmentDate: storedRows[index]?.appointmentDate ?? null,
  }));
}

export function preserveEnrollmentDateOnlyStrings<
  T extends ParsedEnrollment,
>(
  validated: readonly T[],
  storedRows: readonly StoredEnrollment[],
): Array<Omit<T, "enrolledAt"> & { enrolledAt: string }> {
  return validated.map((enrollment, index) => ({
    ...enrollment,
    // Enrollment dates are calendar dates, not instants; keep their database
    // representation so JSON parsing cannot shift them across time zones.
    enrolledAt: storedRows[index]?.enrolledAt ?? "",
  }));
}