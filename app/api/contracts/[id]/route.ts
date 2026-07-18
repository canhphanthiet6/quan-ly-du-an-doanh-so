import { getCurrentUser } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { ensureSchema, getPool } from "../../../../server/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (user.role !== "director") return Response.json({ error: "Chỉ Giám đốc được duyệt hoặc thay đổi hợp đồng" }, { status: 403 });
  const { id } = await params;
  const data = await request.json() as Record<string, unknown>;
  const status = String(data.status || "Chờ duyệt");
  if (!["Chờ duyệt", "Đã ký", "Hủy"].includes(status)) return Response.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ project_id: number; contract_no: string; status: string; contract_value: string }>("SELECT project_id,contract_no,status,contract_value::text FROM contracts WHERE id=$1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw new Error("Không tìm thấy hợp đồng");
    const projectId = current.rows[0].project_id;
    const signedDate = data.signedDate || (status === "Đã ký" ? new Date().toISOString().slice(0, 10) : null);
    await client.query(`UPDATE contracts SET contract_no=COALESCE($1,contract_no),title=COALESCE($2,title),contract_value=COALESCE($3,contract_value),signed_date=$4,status=$5,notes=COALESCE($6,notes),approved_by=CASE WHEN $5 IN ('Đã ký','Hủy') THEN $7 ELSE approved_by END,updated_at=NOW() WHERE id=$8`, [
      data.contractNo || null, data.title || null, data.contractValue !== undefined ? Math.max(0, Number(data.contractValue)) : null,
      signedDate, status, data.notes || null, user.id, id,
    ]);
    const signed = await client.query<{ count: string }>("SELECT COUNT(*)::text count FROM contracts WHERE project_id=$1 AND status='Đã ký'", [projectId]);
    if (Number(signed.rows[0].count) > 0) await client.query("UPDATE projects SET probability=100,status='Hoàn thành',approved_by=$1,updated_at=NOW() WHERE id=$2", [user.id, projectId]);
    else if (status === "Hủy") await client.query("UPDATE projects SET status='Hủy',approved_by=$1,updated_at=NOW() WHERE id=$2", [user.id, projectId]);
    else await client.query("UPDATE projects SET probability=80,status='Chờ khách xác nhận',updated_at=NOW() WHERE id=$1 AND probability=100", [projectId]);
    await writeAudit(client, user, {
      action: status === "Đã ký" ? "APPROVE" : "UPDATE",
      entityType: "contract",
      entityId: id,
      description: `${status === "Đã ký" ? "Duyệt" : "Cập nhật"} hợp đồng ${current.rows[0].contract_no} → ${status}`,
      metadata: { before: current.rows[0], after: { status, contractValue: data.contractValue, signedDate } },
      ...requestAuditMetadata(request),
    });
    await client.query("COMMIT");
    return Response.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể cập nhật hợp đồng" }, { status: 400 });
  } finally {
    client.release();
  }
}
