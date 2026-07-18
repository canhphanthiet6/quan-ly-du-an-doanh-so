import { canManageInventory, getCurrentUser } from "../../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../../server/audit";
import { ensureSchema, getPool } from "../../../../../server/db";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user)) return Response.json({ error: "Không có quyền xóa phiếu kho" }, { status: 403 });
  const { id } = await params;
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      product_id: number; movement_type: string; quantity: string; unit_price: string;
      movement_date: string; note: string; stock_qty: string; product_name: string;
    }>(`
      SELECT m.product_id,m.movement_type,m.quantity::text,m.unit_price::text,m.movement_date::text,m.note,
        p.stock_qty::text,p.name product_name
      FROM inventory_movements m
      JOIN inventory_products p ON p.id=m.product_id
      WHERE m.id=$1
      FOR UPDATE OF m,p
    `, [id]);
    const movement = result.rows[0];
    if (!movement) throw new Error("Không tìm thấy phiếu kho");
    const increasedStock = movement.movement_type === "Nhập" || movement.movement_type === "Điều chỉnh tăng";
    const nextStock = Number(movement.stock_qty) + (increasedStock ? -Number(movement.quantity) : Number(movement.quantity));
    if (nextStock < 0) throw new Error("Không thể xóa phiếu này vì một phần hàng đã được xuất. Hãy tạo phiếu điều chỉnh thay vì xóa.");
    await client.query("DELETE FROM inventory_movements WHERE id=$1", [id]);
    const previousImport = movement.movement_type === "Nhập"
      ? await client.query<{ unit_price: string }>("SELECT unit_price::text FROM inventory_movements WHERE product_id=$1 AND movement_type='Nhập' AND unit_price>0 ORDER BY movement_date DESC,id DESC LIMIT 1", [movement.product_id])
      : null;
    const previousSale = movement.movement_type === "Xuất"
      ? await client.query<{ unit_price: string }>("SELECT unit_price::text FROM inventory_movements WHERE product_id=$1 AND movement_type='Xuất' AND unit_price>0 ORDER BY movement_date DESC,id DESC LIMIT 1", [movement.product_id])
      : null;
    await client.query(`UPDATE inventory_products SET stock_qty=$1,
      cost_price=CASE WHEN $2='Nhập' THEN $3 ELSE cost_price END,
      sale_price=CASE WHEN $2='Xuất' AND $4::NUMERIC IS NOT NULL THEN $4 ELSE sale_price END,
      updated_at=NOW() WHERE id=$5`, [
      nextStock,
      movement.movement_type,
      previousImport?.rows[0]?.unit_price || 0,
      previousSale?.rows[0]?.unit_price || null,
      movement.product_id,
    ]);
    await writeAudit(client, user, {
      action: "DELETE",
      entityType: "inventory_movement",
      entityId: id,
      description: `Xóa phiếu ${movement.movement_type.toLowerCase()} ${movement.product_name} ngày ${movement.movement_date}`,
      metadata: { ...movement, nextStock },
      ...requestAuditMetadata(request),
    });
    await client.query("COMMIT");
    return Response.json({ ok: true, stockQty: nextStock });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể xóa phiếu kho" }, { status: 400 });
  } finally {
    client.release();
  }
}
