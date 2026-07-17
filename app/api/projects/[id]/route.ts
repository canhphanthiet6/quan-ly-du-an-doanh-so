import { canManageAll, getCurrentUser } from "../../../../server/auth";
import { saveCustomer } from "../../../../server/customer";
import { ensureSchema, getPool, query } from "../../../../server/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { id } = await params;
  const own = await query<{ owner_id: number; created_by: number }>("SELECT owner_id,created_by FROM projects WHERE id=$1", [id]);
  const current = own.rows[0];
  if (!current) return Response.json({ error: "Không tìm thấy" }, { status: 404 });
  if (!canManageAll(user) && current.owner_id !== user.id && current.created_by !== user.id) return Response.json({ error: "Bạn không được sửa đơn hàng của người khác" }, { status: 403 });
  const data = await request.json() as Record<string, unknown>;
  const ownerId = canManageAll(user) && data.ownerId ? Number(data.ownerId) : current.owner_id;
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const customerInfo = await saveCustomer(client, data, user.id, ownerId, false);
    await client.query(`UPDATE projects SET name=COALESCE($1,name),contractor=$2,customer_phone=$3,customer_type=$4,sales_channel=$5,customer_id=$6,product=COALESCE($7,product),owner_id=$8,probability=COALESCE($9,probability),status=COALESCE($10,status),value=COALESCE($11,value),deadline=COALESCE($12,deadline),next_action=COALESCE($13,next_action),updated_at=NOW(),approved_by=CASE WHEN $14 THEN $15 ELSE approved_by END WHERE id=$16`, [
      data.name || null, String(data.customerName || "").trim(), String(data.customerPhone || "").trim(), data.customerType || "Khách lẻ", data.salesChannel || "Trực tiếp", customerInfo.id,
      data.product || null, ownerId, data.probability ? Number(data.probability) : null, data.status || null, data.value !== undefined ? Number(data.value) : null,
      data.deadline || null, data.nextAction || null, canManageAll(user), user.id, id,
    ]);
    await client.query("COMMIT");
    return Response.json({ ok: true, customerInfo });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể cập nhật đơn hàng" }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { id } = await params;
  const own = await query<{ owner_id: number; created_by: number }>("SELECT owner_id,created_by FROM projects WHERE id=$1", [id]);
  const project = own.rows[0];
  if (!project) return Response.json({ error: "Không tìm thấy" }, { status: 404 });
  if (!canManageAll(user) && project.owner_id !== user.id && project.created_by !== user.id) return Response.json({ error: "Bạn không được xóa đơn hàng của người khác" }, { status: 403 });
  await query("DELETE FROM projects WHERE id=$1", [id]);
  return Response.json({ ok: true });
}
