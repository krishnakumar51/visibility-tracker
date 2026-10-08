const configuredApiUrl = import.meta.env["VITE_API_URL"]?.trim().replace(/\/+$/, "") ?? "";

export function apiUrl(path: string): string {
  if (import.meta.env.PROD && !configuredApiUrl) {
    throw new Error("Set VITE_API_URL to the deployed FastAPI URL before building the frontend.");
  }
  return `${configuredApiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
