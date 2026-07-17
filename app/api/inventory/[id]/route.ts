import { canManageInventory, getCurrentUser } from "../../../../server/auth";
import { query } from "../../../../server/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user)) return Response.json({ error: "Không có quyền cập nhật kho" }, { status: 403 });
  const { id } = await params;
  const data = await request.json() as Record<string, unknown>;
  try {
    const result = await query(`UPDATE inventory_products SET sku=$1,name=$2,category=$3,unit=$4,cost_price=$5,sale_price=$6,min_stock=$7,peak_months=$8,season_note=$9,updated_at=NOW() WHERE id=$10 RETURNING *`, [
      String(data.sku || "").trim().toUpperCase(), data.name, data.category || "Hải sản", data.unit || "kg",
      Math.max(0, Number(data.costPrice || 0)), Math.max(0, Number(data.salePrice || 0)), Math.max(0, Number(data.minStock || 0)),
      data.peakMonths || "", data.seasonNote || "", id,
    ]);
    if (!result.rows[0]) return Response.json({ error: "Không tìm thấy hàng hóa" }, { status: 404 });
    return Response.json({ product: result.rows[0] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Không thể cập nhật hàng hóa" }, { status: 500 });
  }
}
