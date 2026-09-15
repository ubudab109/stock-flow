export interface JwtPayload {
  /** Subject — the user id. */
  sub: string;
  /** Session id, used to look up the revocable Session row. */
  sid: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  sessionId: string;
}
