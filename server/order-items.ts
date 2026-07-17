import type { PoolClient } from "pg";

type RawItem = { itemId?: number; productId?: number; quantity?: number };
type ProductRow = { id: number; name: string; unit: string; sale_price: string };
type ExistingRow = { id: number; product_id: number; product_name: string; unit: string; unit_price: string; price_date: string };

export type PreparedOrderItem = {
  productId: number;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  priceDate: string;
  lineTotal: number;
};

export async function prepareOrderItems(client: PoolClient, rawValue: unknown, projectId?: number) {
  let rawItems: RawItem[] = [];
  try {
    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    if (Array.isArray(parsed)) rawItems = parsed;
  } catch {
    throw new Error("Danh sách sản phẩm không hợp lệ");
  }

  if (!rawItems.length) throw new Error("Cần thêm ít nhất một sản phẩm vào đơn hàng");
  if (rawItems.length > 50) throw new Error("Một đơn hàng chỉ được tối đa 50 dòng sản phẩm");

  const normalized = rawItems.map((item) => ({
    itemId: Number(item.itemId || 0),
    productId: Number(item.productId || 0),
    quantity: Number(item.quantity || 0),
  }));
  if (normalized.some((item) => !item.productId || !Number.isFinite(item.quantity) || item.quantity <= 0)) {
    throw new Error("Cần chọn sản phẩm và nhập số lượng lớn hơn 0");
  }
  const uniqueProducts = new Set(normalized.map((item) => item.productId));
  if (uniqueProducts.size !== normalized.length) throw new Error("Mỗi sản phẩm chỉ nên xuất hiện một lần trong đơn hàng");

  const productIds = [...uniqueProducts];
  const productResult = await client.query<ProductRow>(
    "SELECT id,name,unit,sale_price::text FROM inventory_products WHERE id=ANY($1::int[]) AND active=TRUE",
    [productIds],
  );
  const products = new Map(productResult.rows.map((product) => [product.id, product]));
  if (products.size !== productIds.length) throw new Error("Có sản phẩm không còn tồn tại trong Kho hàng");

  const itemIds = normalized.map((item) => item.itemId).filter(Boolean);
  const existingResult = projectId && itemIds.length
    ? await client.query<ExistingRow>(
        "SELECT id,product_id,product_name,unit,unit_price::text,price_date::text FROM project_items WHERE project_id=$1 AND id=ANY($2::int[])",
        [projectId, itemIds],
      )
    : { rows: [] as ExistingRow[] };
  const existingItems = new Map(existingResult.rows.map((item) => [item.id, item]));
  const today = new Date().toISOString().slice(0, 10);

  const items: PreparedOrderItem[] = normalized.map((item) => {
    const product = products.get(item.productId)!;
    const existing = item.itemId ? existingItems.get(item.itemId) : undefined;
    const keepSnapshot = existing && existing.product_id === item.productId;
    const unitPrice = Number(keepSnapshot ? existing.unit_price : product.sale_price);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error(`Sản phẩm ${product.name} chưa có giá bán trong Kho hàng`);
    return {
      productId: item.productId,
      productName: keepSnapshot ? existing.product_name : product.name,
      unit: keepSnapshot ? existing.unit : product.unit,
      quantity: item.quantity,
      unitPrice,
      priceDate: keepSnapshot ? existing.price_date : today,
      lineTotal: Math.round(item.quantity * unitPrice),
    };
  });

  return {
    items,
    total: items.reduce((sum, item) => sum + item.lineTotal, 0),
    summary: items.map((item) => item.productName).join(", "),
  };
}

export async function replaceOrderItems(client: PoolClient, projectId: number, items: PreparedOrderItem[]) {
  await client.query("DELETE FROM project_items WHERE project_id=$1", [projectId]);
  for (const item of items) {
    await client.query(
      "INSERT INTO project_items(project_id,product_id,product_name,unit,quantity,unit_price,price_date,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [projectId, item.productId, item.productName, item.unit, item.quantity, item.unitPrice, item.priceDate, item.lineTotal],
    );
  }
}
