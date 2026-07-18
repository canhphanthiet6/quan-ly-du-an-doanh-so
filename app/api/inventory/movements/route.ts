import { canManageInventory, getCurrentUser } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { ensureSchema, getPool, query } from "../../../../server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const result = await query(`SELECT m.*,p.name product_name,p.sku,p.unit,u.full_name creator FROM inventory_movements m JOIN inventory_products p ON p.id=m.product_id LEFT JOIN users u ON u.id=m.created_by ORDER BY m.movement_date DESC,m.id DESC LIMIT 300`);
  return Response.json({ movements: result.rows, canManage: canManageInventory(user) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user)) return Response.json({ error: "Không có quyền xuất nhập kho" }, { status: 403 });
  const data = await request.json() as Record<string, unknown>;
  const productId = Number(data.productId);
  const quantity = Number(data.quantity);
  const movementType = String(data.movementType || "");
  if (!productId || !Number.isFinite(quantity) || quantity <= 0 || !["Nhập", "Xuất", "Điều chỉnh tăng", "Điều chỉnh giảm"].includes(movementType)) {
    return Response.json({ error: "Thông tin xuất nhập kho không hợp lệ" }, { status: 400 });
  }
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const product = await client.query<{ stock_qty: string }>("SELECT stock_qty FROM inventory_products WHERE id=$1 FOR UPDATE", [productId]);
    if (!product.rows[0]) throw new Error("Không tìm thấy hàng hóa");
    const decrease = movementType === "Xuất" || movementType === "Điều chỉnh giảm";
    const nextStock = Number(product.rows[0].stock_qty) + (decrease ? -quantity : quantity);
    if (nextStock < 0) throw new Error("Số lượng xuất vượt quá tồn kho hiện tại");
    const unitPrice = Math.max(0, Number(data.unitPrice || 0));
    await client.query(`INSERT INTO inventory_movements(product_id,movement_type,quantity,unit_price,movement_date,note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)`, [
      productId, movementType, quantity, unitPrice, data.movementDate || new Date().toISOString().slice(0, 10), data.note || "", user.id,
    ]);
    await client.query(`UPDATE inventory_products SET stock_qty=$1,cost_price=CASE WHEN $2='Nhập' AND $3>0 THEN $3 ELSE cost_price END,sale_price=CASE WHEN $2='Xuất' AND $3>0 THEN $3 ELSE sale_price END,updated_at=NOW() WHERE id=$4`, [nextStock, movementType, unitPrice, productId]);
    await writeAudit(client, user, {
      action: "CREATE",
      entityType: "inventory_movement",
      description: `${movementType} kho ${quantity} đơn vị`,
      metadata: { productId, movementType, quantity, unitPrice, nextStock, note: data.note || "" },
      ...requestAuditMetadata(request),
    });
    await client.query("COMMIT");
    return Response.json({ ok: true, stockQty: nextStock }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể cập nhật kho" }, { status: 400 });
  } finally {
    client.release();
  }
}
