// Why a download from Edunex's storage failed, told apart the desktop's way (src/desktop/remote-files.ts):
// a link Edunex no longer honours (Azure answers an expired or revoked link with 403, a removed file
// with 404 or 410) isn't a connection problem, and the Student is sent to Edunex's page instead of
// being told to check their connection. Kept free of Expo so test/mobile runs it.

/** The storage's answer ends the link for good: trying again won't help, Edunex's own page might. */
export function linkGone(status: number): boolean {
  return status === 401 || status === 403 || status === 404 || status === 410;
}

/** The HTTP status in Android's download error ("Unable to download a file: response has status: 403", "HTTP 403"). */
export function statusIn(message: string): number | null {
  const found = /(?:status:?\s*|HTTP\s+)(\d{3})\b/i.exec(message);
  return found ? Number(found[1]) : null;
}
