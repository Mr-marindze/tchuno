export type AuthResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: 'USER' | 'ADMIN';
    adminSubrole?: 'SUPPORT_ADMIN' | 'OPS_ADMIN' | 'SUPER_ADMIN' | null;
  };
  accessToken: string;
  refreshToken: string;
};

export type SessionClientInfo = {
  deviceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};
