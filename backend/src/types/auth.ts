export type Role = 'listener' | 'admin';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface AccessClaims {
  userId: string;
  role: Role;
}
