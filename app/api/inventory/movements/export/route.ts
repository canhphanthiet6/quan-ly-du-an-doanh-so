import { getCurrentUser } from "../../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../../server/audit";
import { getPool, query } from "../../../../../server/db";

const escapeXml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const textCell = (value: unknown) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
const numberCell = (value: unknown) => `<Cell><Data ss:Type="Number">${Number(value || 0)}</Data></Cell>`;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const result = await query(`
    WITH import_history AS (
      SELECT id,LAG(unit_price) OVER (PARTITION BY product_id ORDER BY movement_date,id) previous_unit_price
      FROM inventory_movements WHERE movement_type='Nhập'
    )
    SELECT m.*,p.name product_name,p.sku,p.unit,COALESCE(u.full_name,'') creator,h.previous_unit_price
    FROM inventory_movements m
    JOIN inventory_products p ON p.id=m.product_id
    LEFT JOIN users u ON u.id=m.created_by
    LEFT JOIN import_history h ON h.id=m.id
    ORDER BY m.movement_date DESC,m.id DESC
  `);
  const headers = ["STT","Ngày","Loại phiếu","Mã hàng","Hàng hóa","Số lượng","ĐVT","Đơn giá","Giá nhập trước","Chênh lệch","Tỷ lệ %","Thành tiền","Người tạo","Ghi chú"];
  const rows = result.rows.map((row: Record<string, unknown>, index: number) => {
    const price = Number(row.unit_price || 0);
    const previous = row.previous_unit_price === null ? 0 : Number(row.previous_unit_price || 0);
    const difference = row.movement_type === "Nhập" && previous > 0 ? price - previous : 0;
    const percent = previous > 0 ? difference / previous * 100 : 0;
    return `<Row>${[
      numberCell(index + 1),textCell(row.movement_date),textCell(row.movement_type),textCell(row.sku),textCell(row.product_name),
      numberCell(row.quantity),textCell(row.unit),numberCell(price),numberCell(previous),numberCell(difference),numberCell(percent),
      numberCell(Number(row.quantity || 0) * price),textCell(row.creator),textCell(row.note),
    ].join("")}</Row>`;
  }).join("");
  const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles><Worksheet ss:Name="Lịch sử nhập hàng"><Table><Row ss:StyleID="Header">${headers.map(textCell).join("")}</Row>${rows}</Table></Worksheet></Workbook>`;
  await writeAudit(getPool(), user, { action: "EXPORT", entityType: "inventory_movement", description: `Xuất Excel lịch sử nhập hàng (${result.rows.length} dòng)`, metadata: { rowCount: result.rows.length }, ...requestAuditMetadata(request) });
  const today = new Date().toISOString().slice(0, 10);
  return new Response("\uFEFF" + workbook, { headers: { "content-type": "application/vnd.ms-excel; charset=utf-8", "content-disposition": `attachment; filename="lich-su-nhap-hang-${today}.xls"`, "cache-control": "no-store" } });
}
