export type AuthResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  accessToken: string;
  refreshToken: string;
};

export type SessionClientInfo = {
  deviceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};
