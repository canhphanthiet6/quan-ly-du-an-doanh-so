import { canViewSecurity, getCurrentUser } from "../../../server/auth";
import { query } from "../../../server/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canViewSecurity(user)) return Response.json({ error: "Không có quyền xem nhật ký" }, { status: 403 });
  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(20, Number(url.searchParams.get("limit") || 200)));
  const result = await query(
    `SELECT id,actor_name,actor_role,action,entity_type,entity_id,description,metadata,ip_address,created_at
     FROM audit_logs ORDER BY created_at DESC,id DESC LIMIT $1`,
    [limit],
  );
  return Response.json({ logs: result.rows });
}
