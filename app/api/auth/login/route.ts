import { createSession, verifyPassword } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { getPool, query } from "../../../../server/db";

export async function POST(req:Request){
  try{
    const p=await req.json() as {username?:string;password?:string};
    const username=(p.username||"").toLowerCase().trim();
    const r=await query<{id:number;full_name:string;role:string;password_hash:string;password_salt:string}>("SELECT id,full_name,role,password_hash,password_salt FROM users WHERE username=$1 AND active=TRUE",[username]);
    const u=r.rows[0];
    if(!u||!await verifyPassword(p.password||"",u.password_salt,u.password_hash)){
      await writeAudit(getPool(),null,{action:"LOGIN_FAILED",entityType:"auth",description:`Đăng nhập thất bại với tên ${username||"(trống)"}`,metadata:{username},...requestAuditMetadata(req)});
      return Response.json({error:"Tên đăng nhập hoặc mật khẩu không đúng"},{status:401});
    }
    await getPool().query("UPDATE users SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1",[u.id]);
    await createSession(u.id);
    await writeAudit(getPool(),{id:u.id,fullName:u.full_name,role:u.role},{action:"LOGIN",entityType:"auth",entityId:u.id,description:"Đăng nhập hệ thống",...requestAuditMetadata(req)});
    return Response.json({ok:true});
  }catch(e){return Response.json({error:e instanceof Error?e.message:"Không thể đăng nhập"},{status:500});}
}
