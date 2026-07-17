import { getCurrentUser } from "../../../server/auth";
import { ensureSchema, getPool, query } from "../../../server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const contracts = await query(`
    SELECT ct.*,p.name project_name,p.contractor customer_name,p.customer_phone,
      COALESCE(s.full_name,'Chưa phân công') salesperson,COALESCE(c.full_name,'') creator
    FROM contracts ct
    JOIN projects p ON p.id=ct.project_id
    LEFT JOIN users s ON s.id=ct.salesperson_id
    LEFT JOIN users c ON c.id=ct.created_by
    ORDER BY CASE ct.status WHEN 'Chờ duyệt' THEN 0 WHEN 'Đã ký' THEN 1 ELSE 2 END,ct.created_at DESC
  `);
  const summary = await query(`
    SELECT u.id,u.full_name,u.role,
      COUNT(ct.id) FILTER (WHERE ct.status='Đã ký') AS signed_count,
      COALESCE(SUM(ct.contract_value) FILTER (WHERE ct.status='Đã ký'),0) AS revenue
    FROM users u
    LEFT JOIN contracts ct ON ct.salesperson_id=u.id
    WHERE u.active=TRUE AND (u.role='sales' OR ct.id IS NOT NULL)
    GROUP BY u.id,u.full_name,u.role
    ORDER BY revenue DESC,u.full_name
  `);
  return Response.json({ contracts: contracts.rows, salesSummary: summary.rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const data = await request.json() as Record<string, unknown>;
  const projectId = Number(data.projectId);
  if (!projectId || !data.contractNo) return Response.json({ error: "Cần chọn đơn hàng và nhập số hợp đồng" }, { status: 400 });
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const projectResult = await client.query<{ owner_id: number; created_by: number; customer_id: number; value: string }>("SELECT owner_id,created_by,customer_id,value FROM projects WHERE id=$1 FOR UPDATE", [projectId]);
    const project = projectResult.rows[0];
    if (!project) throw new Error("Không tìm thấy đơn hàng");
    const officeRole = ["director", "admin", "accounting"].includes(user.role);
    if (!officeRole && project.owner_id !== user.id && project.created_by !== user.id) throw new Error("Bạn chỉ được tạo hợp đồng cho đơn hàng của mình");
    const status = user.role === "director" && ["Chờ duyệt", "Đã ký", "Hủy"].includes(String(data.status)) ? String(data.status) : "Chờ duyệt";
    const value = Math.max(0, Number(data.contractValue || project.value || 0));
    const signedDate = data.signedDate || (status === "Đã ký" ? new Date().toISOString().slice(0, 10) : null);
    const result = await client.query(`INSERT INTO contracts(contract_no,project_id,customer_id,title,contract_value,signed_date,status,salesperson_id,notes,created_by,approved_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [
      String(data.contractNo).trim(), projectId, project.customer_id || null, data.title || "", value, signedDate, status,
      project.owner_id || user.id, data.notes || "", user.id, status === "Đã ký" ? user.id : null,
    ]);
    if (status === "Đã ký") await client.query("UPDATE projects SET probability=100,status='Đã chốt đơn',approved_by=$1,updated_at=NOW() WHERE id=$2", [user.id, projectId]);
    await client.query("COMMIT");
    return Response.json({ contract: result.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể tạo hợp đồng" }, { status: 400 });
  } finally {
    client.release();
  }
}
