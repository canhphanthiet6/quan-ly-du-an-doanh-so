import { getCurrentUser } from "../../../server/auth";
import { query } from "../../../server/db";
export async function GET(){const u=await getCurrentUser();if(!u)return Response.json({error:"Chưa đăng nhập"},{status:401});const r=await query<{source:string;title:string;due_date:string;owner:string}>(`
  SELECT 'Đơn hàng' source,p.name title,p.deadline::text due_date,COALESCE(x.full_name,'') owner FROM projects p LEFT JOIN users x ON x.id=p.owner_id WHERE p.deadline BETWEEN CURRENT_DATE-30 AND CURRENT_DATE+7 AND p.status NOT IN ('Hoàn thành','Đã chốt đơn','Đã giao hàng','Hủy','Báo giá hết hiệu lực')
  UNION ALL SELECT 'Kế hoạch',w.title,w.due_date::text,u.full_name FROM weekly_plans w JOIN users u ON u.id=w.user_id WHERE w.due_date BETWEEN CURRENT_DATE-30 AND CURRENT_DATE+7 AND w.status<>'Hoàn thành'
  UNION ALL SELECT 'Công văn',d.subject,d.due_date::text,COALESCE(u.full_name,'') FROM documents d LEFT JOIN users u ON u.id=d.owner_id WHERE d.due_date BETWEEN CURRENT_DATE-30 AND CURRENT_DATE+7 AND d.status<>'Hoàn thành'
  ORDER BY due_date ASC`);const today=new Date();today.setHours(0,0,0,0);return Response.json({notifications:r.rows.map(x=>{const days=Math.ceil((new Date(x.due_date).getTime()-today.getTime())/86400000);return {...x,days,level:days<0?"overdue":days<=2?"urgent":"soon"};})});}
