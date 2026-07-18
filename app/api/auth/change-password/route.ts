import { getCurrentUser, hashPassword, verifyPassword } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { ensureSchema, getPool } from "../../../../server/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const data = await request.json() as { currentPassword?: string; newPassword?: string; confirmPassword?: string };
  if (!data.newPassword || data.newPassword.length < 10) return Response.json({ error: "Mật khẩu mới phải có ít nhất 10 ký tự" }, { status: 400 });
  if (data.newPassword !== data.confirmPassword) return Response.json({ error: "Xác nhận mật khẩu chưa trùng khớp" }, { status: 400 });
  if (!/[A-Za-zÀ-ỹ]/.test(data.newPassword) || !/\d/.test(data.newPassword)) return Response.json({ error: "Mật khẩu cần có cả chữ và số" }, { status: 400 });
  await ensureSchema();
  const pool = getPool();
  const current = await pool.query<{ password_hash: string; password_salt: string }>(
    "SELECT password_hash,password_salt FROM users WHERE id=$1 AND active=TRUE",
    [user.id],
  );
  if (!current.rows[0] || !await verifyPassword(data.currentPassword || "", current.rows[0].password_salt, current.rows[0].password_hash)) {
    return Response.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
  }
  const next = await hashPassword(data.newPassword);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "UPDATE users SET password_hash=$1,password_salt=$2,must_change_password=FALSE,password_changed_at=NOW(),updated_at=NOW() WHERE id=$3",
      [next.hash, next.salt, user.id],
    );
    await writeAudit(client, user, {
      action: "PASSWORD_CHANGE",
      entityType: "user",
      entityId: user.id,
      description: "Người dùng tự đổi mật khẩu",
      ...requestAuditMetadata(request),
    });
    await client.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    await client.query("COMMIT");
    return Response.json({ ok: true, reauthenticate: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể đổi mật khẩu" }, { status: 500 });
  } finally {
    client.release();
  }
}
