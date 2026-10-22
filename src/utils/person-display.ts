/**
 * Presentation-only formatters for person data received from the API.
 * Never mutate persisted records, credentials, identifiers or request payloads.
 */
export function formatPersonName(value?: string | null): string {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s'’\-])([\p{L}])/gu, (_, separator: string, initial: string) =>
      separator + initial.toLocaleUpperCase("pt-BR"));
}

export function formatEmailDisplay(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}
