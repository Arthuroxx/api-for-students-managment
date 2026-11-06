/**
 * Default number of login attempts allowed from a single client IP inside the
 * rolling window defined by `DEFAULT_LOGIN_RATE_TTL_MS`.
 */
export const DEFAULT_LOGIN_RATE_LIMIT = 10;

/** Default length of the login rate-limit window, in milliseconds. */
export const DEFAULT_LOGIN_RATE_TTL_MS = 60_000;
