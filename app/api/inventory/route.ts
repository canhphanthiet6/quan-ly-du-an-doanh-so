import { canManageInventory, getCurrentUser } from "../../../server/auth";
import { ensureSchema, getPool, query } from "../../../server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const result = await query(`
    WITH movement_summary AS (
      SELECT product_id,
        COALESCE(SUM(quantity) FILTER (WHERE movement_type='Xuất' AND movement_date >= CURRENT_DATE - 30),0) AS out_30d,
        COALESCE(SUM(quantity) FILTER (WHERE movement_type='Nhập' AND movement_date >= CURRENT_DATE - 30),0) AS in_30d,
        COALESCE(SUM(quantity) FILTER (WHERE movement_type='Xuất'),0) AS total_out
      FROM inventory_movements
      GROUP BY product_id
    ), product_data AS (
      SELECT p.*, COALESCE(m.out_30d,0) AS out_30d, COALESCE(m.in_30d,0) AS in_30d,
        COALESCE(m.total_out,0) AS total_out
      FROM inventory_products p
      LEFT JOIN movement_summary m ON m.product_id=p.id
      WHERE p.active=TRUE
    )
    SELECT *,
      CASE
        WHEN stock_qty<=0 THEN 'Hết hàng'
        WHEN stock_qty<=min_stock THEN 'Sắp hết'
        WHEN out_30d=0 AND stock_qty>0 THEN 'Bán chậm'
        WHEN out_30d>=GREATEST(1,AVG(out_30d) OVER()) THEN 'Bán chạy'
        ELSE 'Bình thường'
      END AS sales_status,
      GREATEST(0,CEIL(out_30d + min_stock - stock_qty)) AS suggested_qty
    FROM product_data
    ORDER BY CASE WHEN stock_qty<=0 THEN 0 WHEN stock_qty<=min_stock THEN 1 ELSE 2 END, name
  `);
  return Response.json({ products: result.rows, canManage: canManageInventory(user) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canManageInventory(user)) return Response.json({ error: "Không có quyền cập nhật kho" }, { status: 403 });
  const data = await request.json() as Record<string, unknown>;
  if (!data.name || !data.sku) return Response.json({ error: "Cần nhập mã hàng và tên hàng" }, { status: 400 });
  const initialStock = Math.max(0, Number(data.initialStock || 0));
  const costPrice = Math.max(0, Number(data.costPrice || 0));
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const product = await client.query(`INSERT INTO inventory_products(sku,name,category,unit,cost_price,sale_price,stock_qty,min_stock,peak_months,season_note,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [
      String(data.sku).trim().toUpperCase(), String(data.name).trim(), data.category || "Hải sản", data.unit || "kg",
      costPrice, Math.max(0, Number(data.salePrice || 0)), initialStock, Math.max(0, Number(data.minStock || 0)),
      data.peakMonths || "", data.seasonNote || "", user.id,
    ]);
    if (initialStock > 0) {
      await client.query(`INSERT INTO inventory_movements(product_id,movement_type,quantity,unit_price,movement_date,note,created_by) VALUES($1,'Nhập',$2,$3,CURRENT_DATE,'Tồn đầu kỳ',$4)`, [product.rows[0].id, initialStock, costPrice, user.id]);
    }
    await client.query("COMMIT");
    return Response.json({ product: product.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    return Response.json({ error: error instanceof Error ? error.message : "Không thể thêm hàng hóa" }, { status: 500 });
  } finally {
    client.release();
  }
}
