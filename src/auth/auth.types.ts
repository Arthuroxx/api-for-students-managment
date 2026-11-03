export interface JwtPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
