import { getCurrentUser } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { getPool, query } from "../../../../server/db";

const escapeXml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const textCell = (value: unknown) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
const numberCell = (value: unknown) => `<Cell><Data ss:Type="Number">${Number(value || 0)}</Data></Cell>`;
const displayDate = (value: unknown) => value ? new Date(String(value)).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const result = await query(`
    SELECT c.*,COALESCE(u.full_name,'Chưa phân công') owner,
      COALESCE(p.quote_count,0) AS quote_count,
      COALESCE(ct.signed_revenue,0) AS signed_revenue,COALESCE(ct.signed_count,0) AS signed_count
    FROM customers c
    LEFT JOIN users u ON u.id=c.assigned_to
    LEFT JOIN LATERAL (SELECT COUNT(*) quote_count FROM projects WHERE customer_id=c.id) p ON TRUE
    LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE status='Đã ký') signed_count,COALESCE(SUM(contract_value) FILTER (WHERE status='Đã ký'),0) signed_revenue FROM contracts WHERE customer_id=c.id) ct ON TRUE
    ORDER BY c.last_contact_at DESC,c.id DESC
  `);
  const headers = ["STT", "Tên khách hàng", "Số điện thoại", "Khu vực / địa chỉ", "Loại khách", "Kênh bán", "Số lần liên hệ", "Đơn / báo giá", "Hợp đồng đã ký", "Doanh số", "Sale phụ trách", "Ngày lưu data", "Lần liên hệ gần nhất"];
  const rows = result.rows.map((customer: Record<string, unknown>, index: number) => `<Row>${[
    numberCell(index + 1), textCell(customer.name), textCell(customer.phone), textCell(customer.address),
    textCell(customer.customer_type), textCell(customer.sales_channel), numberCell(customer.contact_count),
    numberCell(customer.quote_count), numberCell(customer.signed_count), numberCell(customer.signed_revenue),
    textCell(customer.owner), textCell(displayDate(customer.created_at)), textCell(displayDate(customer.last_contact_at)),
  ].join("")}</Row>`).join("");
  const workbook = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style></Styles>
  <Worksheet ss:Name="Data khách hàng"><Table>
    <Row ss:StyleID="Header">${headers.map(textCell).join("")}</Row>${rows}
  </Table></Worksheet>
</Workbook>`;
  await writeAudit(getPool(), user, {
    action: "EXPORT",
    entityType: "customer",
    description: `Xuất Excel Data khách hàng (${result.rows.length} khách)`,
    metadata: { rowCount: result.rows.length },
    ...requestAuditMetadata(request),
  });
  const today = new Date().toISOString().slice(0, 10);
  return new Response("\uFEFF" + workbook, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="data-khach-hang-${today}.xls"`,
      "cache-control": "no-store",
    },
  });
}
