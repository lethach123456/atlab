export type UserRole = 'admin' | 'sale' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  workspaceOwnerId: string;
  createdAt?: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  active?: boolean;
}
