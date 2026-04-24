function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

export function getApiBaseUrl() {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!configured) return "/api";

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isRemotePage = !isLocalHost(host);
    const pointsToLocalBackend = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(configured);
    const mixedContentRisk = window.location.protocol === "https:" && configured.startsWith("http://");

    // If app is opened remotely (e.g., tunnel/domain), local backend URLs or insecure HTTP URLs break requests.
    if (isRemotePage && (pointsToLocalBackend || mixedContentRisk)) {
      return "/api";
    }
  }

  return configured;
}
