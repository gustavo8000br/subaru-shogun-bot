/** Accept only the local, throwaway database contract used by test-integration.sh. */
export function isEphemeralTestDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "postgresql:"
      && parsed.hostname === "127.0.0.1"
      && parsed.pathname === "/shogun_test"
      && parsed.username === "shogun_test"
      && parsed.password === "shogun_test_ephemeral_only"
      && parsed.port.length > 0
      && parsed.searchParams.get("schema") === "public";
  } catch {
    return false;
  }
}
