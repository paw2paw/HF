export type Role = "SUPERADMIN" | "ADMIN";

export function getRoleFromRequest(req: Request): Role | null {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  if (!token) return null;

  // MVP: single token = superadmin
  if (token === process.env.HF_SUPERADMIN_TOKEN) return "SUPERADMIN";

  // You can add admin tokens or real auth later
  return null;
}

export function requireRole(req: Request, allowed: Role[]) {
  const role = getRoleFromRequest(req);
  if (!role || !allowed.includes(role)) {
    const err = new Error("Unauthorized");
    (err as any).status = 401;
    throw err;
  }
  return role;
}
