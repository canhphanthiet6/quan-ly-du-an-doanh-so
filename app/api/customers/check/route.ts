import { getCurrentUser } from "../../../../server/auth";
import { normalizeCustomerName, normalizeCustomerPhone } from "../../../../server/customer";
import { query } from "../../../../server/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const url = new URL(request.url);
  const name = normalizeCustomerName(url.searchParams.get("name"));
  const phone = normalizeCustomerPhone(url.searchParams.get("phone"));
  if (!name || phone.length < 8) return Response.json({ found: false });
  const result = await query<{ id: number; name: string; phone: string; contact_count: number; last_contact_at: string; owner: string }>(`
    SELECT c.id,c.name,c.phone,c.contact_count,c.last_contact_at,COALESCE(u.full_name,'Chưa phân công') owner
    FROM customers c LEFT JOIN users u ON u.id=c.assigned_to
    WHERE c.normalized_name=$1 AND c.normalized_phone=$2 LIMIT 1
  `, [name, phone]);
  const customer = result.rows[0];
  return Response.json(customer ? { found: true, customer, nextReturnNumber: customer.contact_count } : { found: false });
}
