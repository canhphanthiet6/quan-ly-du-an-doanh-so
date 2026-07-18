import { canManageInventory, getCurrentUser } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { ensureSchema, getPool } from "../../../../server/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user)) return Response.json({ error: "Không có quyền cập nhật kho" }, { status: 403 });
  const { id } = await params;
  const data = await request.json() as Record<string, unknown>;
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const before = await client.query("SELECT sku,name,cost_price,sale_price,min_stock FROM inventory_products WHERE id=$1 FOR UPDATE", [id]);
    const result = await client.query(`UPDATE inventory_products SET sku=$1,name=$2,category=$3,unit=$4,cost_price=$5,sale_price=$6,min_stock=$7,peak_months=$8,season_note=$9,updated_at=NOW() WHERE id=$10 RETURNING *`, [
      String(data.sku || "").trim().toUpperCase(), data.name, data.category || "Hải sản", data.unit || "kg",
      Math.max(0, Number(data.costPrice || 0)), Math.max(0, Number(data.salePrice || 0)), Math.max(0, Number(data.minStock || 0)),
      data.peakMonths || "", data.seasonNote || "", id,
    ]);
    if (!result.rows[0]) { await client.query("ROLLBACK"); return Response.json({ error: "Không tìm thấy hàng hóa" }, { status: 404 }); }
    await writeAudit(client, user, {
      action: "UPDATE",
      entityType: "inventory_product",
      entityId: id,
      description: `Cập nhật hàng hóa ${String(data.name || "")}`,
      metadata: { before: before.rows[0] || null, after: { sku: result.rows[0].sku, name: result.rows[0].name, cost_price: result.rows[0].cost_price, sale_price: result.rows[0].sale_price, min_stock: result.rows[0].min_stock } },
      ...requestAuditMetadata(request),
    });
    await client.query("COMMIT");
    return Response.json({ product: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể cập nhật hàng hóa" }, { status: 500 });
  } finally {
    client.release();
  }
}
