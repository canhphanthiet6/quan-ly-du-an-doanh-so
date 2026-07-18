import { getCurrentUser } from "../../../server/auth";
import { query } from "../../../server/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const url = new URL(request.url);
  const fallback = new Date().toISOString().slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(url.searchParams.get("month") || "")
    ? String(url.searchParams.get("month"))
    : fallback;
  const monthStart = month + "-01";

  const result = await query(`
    WITH channel_names AS (
      SELECT UNNEST(ARRAY[
        'Trực tiếp','Facebook','Zalo','TikTok','Khách giới thiệu',
        'Khách cũ quay lại','Điện thoại','Khác'
      ]::TEXT[]) AS channel
      UNION
      SELECT COALESCE(NULLIF(TRIM(sales_channel),''),'Khác') FROM projects
    ),
    quote_totals AS (
      SELECT COALESCE(NULLIF(TRIM(sales_channel),''),'Khác') AS channel,
        COUNT(*)::INTEGER AS quote_count,
        COUNT(DISTINCT customer_id)::INTEGER AS customer_count,
        COALESCE(SUM(value),0) AS expected_value
      FROM projects
      WHERE created_at >= $1::DATE
        AND created_at < $1::DATE + INTERVAL '1 month'
        AND status NOT IN ('Hủy','Báo giá hết hiệu lực')
      GROUP BY 1
    ),
    signed_totals AS (
      SELECT COALESCE(NULLIF(TRIM(p.sales_channel),''),'Khác') AS channel,
        COUNT(ct.id)::INTEGER AS signed_count,
        COALESCE(SUM(ct.contract_value),0) AS revenue
      FROM contracts ct
      JOIN projects p ON p.id=ct.project_id
      WHERE ct.status='Đã ký'
        AND COALESCE(ct.signed_date,ct.created_at::DATE) >= $1::DATE
        AND COALESCE(ct.signed_date,ct.created_at::DATE) < $1::DATE + INTERVAL '1 month'
      GROUP BY 1
    )
    SELECT names.channel AS sales_channel,
      COALESCE(quotes.quote_count,0) AS quote_count,
      COALESCE(quotes.customer_count,0) AS customer_count,
      COALESCE(quotes.expected_value,0) AS expected_value,
      COALESCE(signed.signed_count,0) AS signed_count,
      COALESCE(signed.revenue,0) AS revenue
    FROM channel_names names
    LEFT JOIN quote_totals quotes ON quotes.channel=names.channel
    LEFT JOIN signed_totals signed ON signed.channel=names.channel
    ORDER BY revenue DESC,quote_count DESC,names.channel
  `, [monthStart]);

  return Response.json({ month, channels: result.rows });
}
