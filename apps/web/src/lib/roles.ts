export const ROLE_LEVELS: Record<string, number> = {
  r1: 1, r2: 2, r3: 3, r4: 4, r5: 5, admin: 99,
};

export function hasRole(userRole: string | null | undefined, minRole: string): boolean {
  return (ROLE_LEVELS[userRole ?? ""] ?? 0) >= (ROLE_LEVELS[minRole] ?? 0);
}
