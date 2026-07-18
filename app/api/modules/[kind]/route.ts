import { getCurrentUser } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { ensureSchema, getPool, query } from "../../../../server/db";
const allowed=["reports","plans","documents","events"] as const;
export async function GET(_:Request,{params}:{params:Promise<{kind:string}>}){const u=await getCurrentUser();if(!u)return Response.json({error:"Chưa đăng nhập"},{status:401});const {kind}=await params;if(!allowed.includes(kind as never))return Response.json({error:"Không hợp lệ"},{status:404});const sql=kind==="reports"?`SELECT r.*,u.full_name owner FROM work_reports r JOIN users u ON u.id=r.user_id ORDER BY report_date DESC,id DESC`:kind==="plans"?`SELECT p.*,u.full_name owner FROM weekly_plans p JOIN users u ON u.id=p.user_id ORDER BY week_start DESC,id DESC`:kind==="documents"?`SELECT d.*,COALESCE(u.full_name,'Chưa phân công') owner FROM documents d LEFT JOIN users u ON u.id=d.owner_id ORDER BY issue_date DESC,id DESC`:`SELECT e.*,COALESCE(u.full_name,'Chưa phân công') owner FROM events e LEFT JOIN users u ON u.id=e.owner_id ORDER BY start_at ASC`;const r=await query(sql);return Response.json({items:r.rows,user:u});}
export async function POST(req:Request,{params}:{params:Promise<{kind:string}>}){
  const u=await getCurrentUser();
  if(!u)return Response.json({error:"Chưa đăng nhập"},{status:401});
  const {kind}=await params;
  if(!allowed.includes(kind as never))return Response.json({error:"Không hợp lệ"},{status:404});
  if(["documents","events"].includes(kind)&&!["director","admin","hr"].includes(u.role))return Response.json({error:"Chỉ Giám đốc, Admin hoặc Hành chính được thêm dữ liệu này"},{status:403});
  const p=await req.json() as Record<string,unknown>;
  await ensureSchema();
  const client=await getPool().connect();
  try{
    await client.query("BEGIN");
    let r;
    if(kind==="reports")r=await client.query(`INSERT INTO work_reports(user_id,report_date,customer,project_name,content,result,next_action,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[u.id,p.reportDate||new Date().toISOString().slice(0,10),p.customer||"",p.projectName||"",p.content,p.result||"",p.nextAction||"",p.dueDate||null]);
    else if(kind==="plans")r=await client.query(`INSERT INTO weekly_plans(user_id,week_start,title,detail,due_date,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[u.id,p.weekStart,p.title,p.detail||"",p.dueDate||null,p.status||"Chưa thực hiện"]);
    else if(kind==="documents")r=await client.query(`INSERT INTO documents(direction,document_no,subject,partner,issue_date,owner_id,due_date,status,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[p.direction||"Đến",p.documentNo||"",p.subject,p.partner||"",p.issueDate||new Date().toISOString().slice(0,10),u.id,p.dueDate||null,p.status||"Đang xử lý",p.notes||"",u.id]);
    else r=await client.query(`INSERT INTO events(event_type,title,start_at,end_at,location,participants,owner_id,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[p.eventType||"Họp",p.title,p.startAt,p.endAt||null,p.location||"",p.participants||"",u.id,p.notes||"",u.id]);
    const labels:Record<string,string>={reports:"báo cáo công việc",plans:"kế hoạch tuần",documents:"công văn",events:"lịch công việc"};
    await writeAudit(client,u,{action:"CREATE",entityType:kind,entityId:r.rows[0].id,description:`Thêm ${labels[kind]}`,...requestAuditMetadata(req)});
    await client.query("COMMIT");
    return Response.json({item:r.rows[0]},{status:201});
  }catch(e){await client.query("ROLLBACK");return Response.json({error:e instanceof Error?e.message:"Không thể lưu"},{status:500});}
  finally{client.release();}
}
