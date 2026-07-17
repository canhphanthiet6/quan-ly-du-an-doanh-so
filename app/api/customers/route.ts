import { getCurrentUser } from "../../../server/auth";
import { query } from "../../../server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const result = await query(`
    SELECT c.*,COALESCE(u.full_name,'Chưa phân công') owner,
      COALESCE(p.quote_count,0) AS quote_count,p.latest_quote_at,
      COALESCE(ct.signed_revenue,0) AS signed_revenue,COALESCE(ct.signed_count,0) AS signed_count
    FROM customers c
    LEFT JOIN users u ON u.id=c.assigned_to
    LEFT JOIN LATERAL (SELECT COUNT(*) quote_count,MAX(updated_at) latest_quote_at FROM projects WHERE customer_id=c.id) p ON TRUE
    LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE status='Đã ký') signed_count,COALESCE(SUM(contract_value) FILTER (WHERE status='Đã ký'),0) signed_revenue FROM contracts WHERE customer_id=c.id) ct ON TRUE
    ORDER BY c.last_contact_at DESC,c.id DESC
  `);
  return Response.json({ customers: result.rows });
}
