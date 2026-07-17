import { canManageAll, getCurrentUser } from "../../../server/auth";
import { saveCustomer } from "../../../server/customer";
import { ensureSchema, getPool, query } from "../../../server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const result = await query(`SELECT p.*,COALESCE(o.full_name,'Chưa phân công') owner,c.full_name creator FROM projects p LEFT JOIN users o ON o.id=p.owner_id LEFT JOIN users c ON c.id=p.created_by ORDER BY p.updated_at DESC`);
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
    const result = await client.query(`INSERT INTO projects(code,name,contractor,customer_phone,customer_type,sales_channel,customer_id,product,owner_id,probability,status,value,deadline,next_action,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [
      data.code, data.name, String(data.customerName || "").trim(), String(data.customerPhone || "").trim(), data.customerType || "Khách lẻ", data.salesChannel || "Trực tiếp", customerInfo.id,
      data.product || "", ownerId, Number(data.probability || 30), data.status || "Khách mới / Quan tâm", Number(data.value || 0), data.deadline || null, data.nextAction || "", user.id,
    ]);
    await client.query("COMMIT");
    return Response.json({ project: result.rows[0], customerInfo }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể thêm đơn hàng" }, { status: 400 });
  } finally {
    client.release();
  }
}
