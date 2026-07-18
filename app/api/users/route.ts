import { canManageUsers, getCurrentUser, hashPassword, roleLabels, Role } from "../../../server/auth";
import { requestAuditMetadata, writeAudit } from "../../../server/audit";
import { ensureSchema, getPool } from "../../../server/db";

export async function GET(){
  const u=await getCurrentUser();
  if(!u||!canManageUsers(u))return Response.json({error:"Không có quyền xem quản trị nhân sự"},{status:403});
  await ensureSchema();
  const r=await getPool().query<{id:number;username:string;full_name:string;role:Role;active:boolean;must_change_password:boolean;last_login_at:string;password_changed_at:string;created_at:string}>("SELECT id,username,full_name,role,active,must_change_password,last_login_at,password_changed_at,created_at FROM users ORDER BY CASE role WHEN 'director' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,id");
  return Response.json({users:r.rows.map(x=>({...x,role_label:roleLabels[x.role]}))});
}

export async function POST(req:Request){
  const u=await getCurrentUser();
  if(!u||!canManageUsers(u))return Response.json({error:"Không có quyền tạo tài khoản"},{status:403});
  try{
    const p=await req.json() as {username?:string;fullName?:string;role?:Role;password?:string};
    if(!p.username||!p.fullName||!p.role||!p.password||p.password.length<10)return Response.json({error:"Thiếu thông tin hoặc mật khẩu dưới 10 ký tự"},{status:400});
    if(!/[A-Za-zÀ-ỹ]/.test(p.password)||!/\d/.test(p.password))return Response.json({error:"Mật khẩu tạm cần có cả chữ và số"},{status:400});
    if(!["director","admin","sales","accounting","hr"].includes(p.role))return Response.json({error:"Vai trò không hợp lệ"},{status:400});
    if(u.role!=="director"&&p.role==="director")return Response.json({error:"Chỉ Giám đốc được tạo thêm tài khoản Giám đốc"},{status:403});
    await ensureSchema();
    const pass=await hashPassword(p.password);
    const client=await getPool().connect();
    try{
      await client.query("BEGIN");
      const r=await client.query("INSERT INTO users(username,full_name,role,password_hash,password_salt) VALUES($1,$2,$3,$4,$5) RETURNING id,username,full_name,role,active,must_change_password",[p.username.toLowerCase().trim(),p.fullName.trim(),p.role,pass.hash,pass.salt]);
      await writeAudit(client,u,{action:"USER_CREATE",entityType:"user",entityId:r.rows[0].id,description:`Tạo tài khoản ${p.fullName.trim()} (${roleLabels[p.role]})`,metadata:{username:r.rows[0].username,role:p.role},...requestAuditMetadata(req)});
      await client.query("COMMIT");
      return Response.json({user:r.rows[0]},{status:201});
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }catch(e){
    const message=e instanceof Error?e.message:"Không thể tạo tài khoản";
    return Response.json({error:message.includes("users_username_key")?"Tên đăng nhập đã tồn tại":message},{status:400});
  }
}
