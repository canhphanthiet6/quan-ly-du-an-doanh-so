import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { query } from "./db";

const scrypt = promisify(scryptCallback);
export type Role = "director" | "admin" | "sales" | "accounting" | "hr";
export type CurrentUser = { id: number; username: string; fullName: string; role: Role; mustChangePassword: boolean };
export const roleLabels: Record<Role,string> = { director:"Giám đốc", admin:"Admin", sales:"Sales", accounting:"Kế toán", hr:"Hành chính" };

export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = await scrypt(password, salt, 64) as Buffer;
  return { hash: derived.toString("hex"), salt };
}
export async function verifyPassword(password: string, salt: string, expected: string) {
  const derived = await scrypt(password, salt, 64) as Buffer;
  const target = Buffer.from(expected, "hex");
  return target.length === derived.length && timingSafeEqual(target, derived);
}
const digest = (token:string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId:number) {
  const token = randomBytes(32).toString("base64url");
  await query("DELETE FROM sessions WHERE expires_at < NOW()");
  await query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '7 days')",[digest(token),userId]);
  const jar = await cookies();
  jar.set("vw_session",token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*7});
}
export async function destroySession(){const jar=await cookies();const token=jar.get("vw_session")?.value;if(token)await query("DELETE FROM sessions WHERE token_hash=$1",[digest(token)]);jar.delete("vw_session");}
export async function getCurrentUser():Promise<CurrentUser|null>{
  try{const token=(await cookies()).get("vw_session")?.value;if(!token)return null;const r=await query<{id:number;username:string;full_name:string;role:Role;must_change_password:boolean}>(`SELECT u.id,u.username,u.full_name,u.role,u.must_change_password FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.active=TRUE`,[digest(token)]);const u=r.rows[0];return u?{id:u.id,username:u.username,fullName:u.full_name,role:u.role,mustChangePassword:u.must_change_password}:null;}catch{return null;}
}
export function canManageAll(user:CurrentUser){return user.role==="director";}
export function canManageUsers(user:CurrentUser){return user.role==="director"||user.role==="admin";}
export function canViewSecurity(user:CurrentUser){return user.role==="director"||user.role==="admin";}
export function canManageInventory(user:CurrentUser){return user.role==="director"||user.role==="admin"||user.role==="accounting";}
