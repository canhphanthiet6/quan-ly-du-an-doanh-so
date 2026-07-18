import { canManageAll, getCurrentUser } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { saveCustomer } from "../../../../server/customer";
import { ensureSchema, getPool, query } from "../../../../server/db";
import { prepareOrderItems, replaceOrderItems } from "../../../../server/order-items";

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
    const orderDetail = await prepareOrderItems(client, data.itemsJson, Number(id));
    await client.query(`UPDATE projects SET name=COALESCE($1,name),contractor=$2,customer_phone=$3,customer_type=$4,sales_channel=$5,customer_id=$6,product=COALESCE($7,product),owner_id=$8,probability=COALESCE($9,probability),status=COALESCE($10,status),value=COALESCE($11,value),deadline=COALESCE($12,deadline),next_action=COALESCE($13,next_action),updated_at=NOW(),approved_by=CASE WHEN $14 THEN $15 ELSE approved_by END WHERE id=$16`, [
      data.name || null, String(data.customerName || "").trim(), String(data.customerPhone || "").trim(), data.customerType || "Khách lẻ", data.salesChannel || "Trực tiếp", customerInfo.id,
      orderDetail.summary, ownerId, data.probability ? Number(data.probability) : null, data.status || null, orderDetail.total,
      data.deadline || null, data.nextAction || null, canManageAll(user), user.id, id,
    ]);
    await replaceOrderItems(client, Number(id), orderDetail.items);
    await writeAudit(client, user, {
      action: "UPDATE",
      entityType: "project",
      entityId: id,
      description: `Cập nhật đơn hàng ${String(data.name || id)}`,
      metadata: { value: orderDetail.total, ownerId, status: data.status || null, items: orderDetail.items.length },
      ...requestAuditMetadata(request),
    });
    await client.query("COMMIT");
    return Response.json({ ok: true, customerInfo });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể cập nhật đơn hàng" }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const { id } = await params;
  const own = await query<{ owner_id: number; created_by: number; code: string; name: string; value: string }>("SELECT owner_id,created_by,code,name,value::text FROM projects WHERE id=$1", [id]);
  const project = own.rows[0];
  if (!project) return Response.json({ error: "Không tìm thấy" }, { status: 404 });
  if (!canManageAll(user) && project.owner_id !== user.id && project.created_by !== user.id) return Response.json({ error: "Bạn không được xóa đơn hàng của người khác" }, { status: 403 });
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM projects WHERE id=$1", [id]);
    await writeAudit(client, user, {
      action: "DELETE",
      entityType: "project",
      entityId: id,
      description: `Xóa đơn hàng ${project.code} · ${project.name}`,
      metadata: { value: project.value },
      ...requestAuditMetadata(request),
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể xóa đơn hàng" }, { status: 400 });
  } finally {
    client.release();
  }
  return Response.json({ ok: true });
}
