import { canManageAll, getCurrentUser } from "../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../server/audit";
import { saveCustomer } from "../../../server/customer";
import { ensureSchema, getPool, query } from "../../../server/db";
import { prepareOrderItems, replaceOrderItems } from "../../../server/order-items";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const result = await query(`
    SELECT p.*,COALESCE(o.full_name,'Chưa phân công') owner,c.full_name creator,
      COALESCE(lines.items,'[]'::json) items
    FROM projects p
    LEFT JOIN users o ON o.id=p.owner_id
    LEFT JOIN users c ON c.id=p.created_by
    LEFT JOIN LATERAL (
      SELECT JSON_AGG(JSON_BUILD_OBJECT(
        'id',pi.id,'product_id',pi.product_id,'product_name',pi.product_name,
        'unit',pi.unit,'quantity',pi.quantity,'unit_price',pi.unit_price,
        'price_date',pi.price_date,'line_total',pi.line_total
      ) ORDER BY pi.id) items
      FROM project_items pi WHERE pi.project_id=p.id
    ) lines ON TRUE
    ORDER BY p.updated_at DESC
  `);
  return Response.json({ projects: result.rows, user });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const data = await request.json() as Record<string, unknown>;
  const ownerId = canManageAll(user) && data.ownerId ? Number(data.ownerId) : user.id;
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const customerInfo = await saveCustomer(client, data, user.id, ownerId, true);
    const orderDetail = await prepareOrderItems(client, data.itemsJson);
    const result = await client.query(`INSERT INTO projects(code,name,contractor,customer_phone,customer_type,sales_channel,customer_id,product,owner_id,probability,status,value,deadline,next_action,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [
      data.code, data.name, String(data.customerName || "").trim(), String(data.customerPhone || "").trim(), data.customerType || "Khách lẻ", data.salesChannel || "Trực tiếp", customerInfo.id,
      orderDetail.summary, ownerId, Number(data.probability || 30), data.status || "Khách mới / Quan tâm", orderDetail.total, data.deadline || null, data.nextAction || "", user.id,
    ]);
    await replaceOrderItems(client, result.rows[0].id, orderDetail.items);
    await writeAudit(client, user, {
      action: "CREATE",
      entityType: "project",
      entityId: result.rows[0].id,
      description: `Thêm đơn hàng ${String(data.code || "")} · ${String(data.name || "")}`,
      metadata: { value: orderDetail.total, ownerId, customerId: customerInfo.id, items: orderDetail.items.length },
      ...requestAuditMetadata(request),
    });
    await client.query("COMMIT");
    return Response.json({ project: result.rows[0], customerInfo }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể thêm đơn hàng" }, { status: 400 });
  } finally {
    client.release();
  }
}
