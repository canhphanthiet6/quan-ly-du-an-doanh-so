import { createSession, hashPassword } from "../../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../../server/audit";
import { ensureSchema, getPool, query } from "../../../../server/db";

export async function POST(req:Request){
  try{
    const count=await query<{count:string}>("SELECT COUNT(*)::text AS count FROM users");
    if(Number(count.rows[0].count)>0)return Response.json({error:"Hệ thống đã được thiết lập"},{status:409});
    const p=await req.json() as {fullName?:string;username?:string;password?:string};
    if(!p.fullName||!p.username||!p.password||p.password.length<10)return Response.json({error:"Vui lòng nhập đủ thông tin; mật khẩu tối thiểu 10 ký tự"},{status:400});
    if(!/[A-Za-zÀ-ỹ]/.test(p.password)||!/\d/.test(p.password))return Response.json({error:"Mật khẩu cần có cả chữ và số"},{status:400});
    await ensureSchema();
    const pass=await hashPassword(p.password);
    const client=await getPool().connect();
    try{
      await client.query("BEGIN");
      const r=await client.query<{id:number}>("INSERT INTO users(username,full_name,role,password_hash,password_salt,must_change_password,password_changed_at) VALUES($1,$2,'director',$3,$4,FALSE,NOW()) RETURNING id",[p.username.toLowerCase().trim(),p.fullName.trim(),pass.hash,pass.salt]);
      await writeAudit(client,{id:r.rows[0].id,fullName:p.fullName.trim(),role:"director"},{action:"SYSTEM_SETUP",entityType:"user",entityId:r.rows[0].id,description:"Thiết lập tài khoản Giám đốc đầu tiên",...requestAuditMetadata(req)});
      await client.query("COMMIT");
      global.__seafoodBackupDate=undefined;
      await createSession(r.rows[0].id);
      return Response.json({ok:true});
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }catch(e){return Response.json({error:e instanceof Error?e.message:"Không thể thiết lập"},{status:500});}
}
