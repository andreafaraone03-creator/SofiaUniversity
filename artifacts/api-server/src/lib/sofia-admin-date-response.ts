type ParsedOrientationRequest = {
  appointmentDate: unknown;
};

type StoredOrientationRequest = {
  appointmentDate: string | null | undefined;
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