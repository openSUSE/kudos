

/** Accept only same-app paths stored on notification rows. */
export function safeNotificationPath(link) {
  if (typeof link !== "string" || !link.startsWith("/") || link.startsWith("//") || link.startsWith("/\\") || /[\u0000-\u001f]/.test(link)) {
    return null;
  }

  try {
    const url = new URL(link, "https://kudos.invalid");
    if (url.origin !== "https://kudos.invalid") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
