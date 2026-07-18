import { canManageUsers, getCurrentUser, hashPassword, roleLabels, Role } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { ensureSchema, getPool } from "../../../../server/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentUser();
  if (!actor || !canManageUsers(actor)) return Response.json({ error: "Không có quyền quản lý tài khoản" }, { status: 403 });
  const { id } = await params;
  const userId = Number(id);
  if (!userId) return Response.json({ error: "Tài khoản không hợp lệ" }, { status: 400 });
  const data = await request.json() as { fullName?: string; role?: Role; active?: boolean | string; temporaryPassword?: string };
  if (!data.fullName?.trim()) return Response.json({ error: "Cần nhập họ và tên" }, { status: 400 });
  if (!data.role || !Object.keys(roleLabels).includes(data.role)) return Response.json({ error: "Vai trò không hợp lệ" }, { status: 400 });
  if (data.temporaryPassword && data.temporaryPassword.length < 10) return Response.json({ error: "Mật khẩu tạm phải có ít nhất 10 ký tự" }, { status: 400 });
  if (data.temporaryPassword && (!/[A-Za-zÀ-ỹ]/.test(data.temporaryPassword) || !/\d/.test(data.temporaryPassword))) return Response.json({ error: "Mật khẩu tạm cần có cả chữ và số" }, { status: 400 });

  await ensureSchema();
  const nextActive = data.active !== false && data.active !== "false";
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query<{ id: number; full_name: string; role: Role; active: boolean }>(
      "SELECT id,full_name,role,active FROM users WHERE id=$1 FOR UPDATE",
      [userId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new Error("Không tìm thấy tài khoản");
    if (actor.role !== "director" && (current.role === "director" || data.role === "director")) throw new Error("Chỉ Giám đốc được quản lý tài khoản Giám đốc");
    if (actor.id === userId && !nextActive) throw new Error("Không thể tự khóa tài khoản đang đăng nhập");
    if (current.role === "director" && (data.role !== "director" || !nextActive)) {
      const directors = await client.query<{ count: string }>("SELECT COUNT(*)::text count FROM users WHERE role='director' AND active=TRUE");
      if (Number(directors.rows[0].count) <= 1) throw new Error("Hệ thống phải còn ít nhất một tài khoản Giám đốc hoạt động");
    }

    let passwordHash: string | null = null;
    let passwordSalt: string | null = null;
    if (data.temporaryPassword) {
      const password = await hashPassword(data.temporaryPassword);
      passwordHash = password.hash;
      passwordSalt = password.salt;
    }
    const result = await client.query(
      `UPDATE users SET full_name=$1,role=$2,active=$3,
        password_hash=COALESCE($4,password_hash),password_salt=COALESCE($5,password_salt),
        must_change_password=CASE WHEN $4 IS NOT NULL THEN TRUE ELSE must_change_password END,
        password_changed_at=CASE WHEN $4 IS NOT NULL THEN NULL ELSE password_changed_at END,updated_at=NOW()
       WHERE id=$6 RETURNING id,username,full_name,role,active,must_change_password`,
      [data.fullName.trim(), data.role, nextActive, passwordHash, passwordSalt, userId],
    );
    if (!nextActive || data.temporaryPassword) await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
    const actions: string[] = [];
    if (current.role !== data.role) actions.push(`đổi vai trò ${roleLabels[current.role]} → ${roleLabels[data.role]}`);
    if (current.active !== nextActive) actions.push(!nextActive ? "khóa tài khoản" : "mở khóa tài khoản");
    if (data.temporaryPassword) actions.push("đặt lại mật khẩu tạm");
    if (current.full_name !== data.fullName.trim()) actions.push("cập nhật họ tên");
    await writeAudit(client, actor, {
      action: data.temporaryPassword ? "PASSWORD_RESET" : !nextActive ? "ACCOUNT_LOCK" : !current.active ? "ACCOUNT_UNLOCK" : "USER_UPDATE",
      entityType: "user",
      entityId: userId,
      description: `${actions.join(", ") || "Cập nhật tài khoản"}: ${data.fullName.trim()}`,
      metadata: { before: current, after: result.rows[0] },
      ...requestAuditMetadata(request),
    });
    await client.query("COMMIT");
    return Response.json({ user: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể cập nhật tài khoản" }, { status: 400 });
  } finally {
    client.release();
  }
}
