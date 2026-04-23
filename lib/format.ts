export function toIsoFromLocalDateTime(value: string) {
  return new Date(value).toISOString();
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
