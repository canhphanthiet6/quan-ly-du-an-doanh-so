import { query } from "../../../../server/db";
import { getCurrentUser, roleLabels } from "../../../../server/auth";
export async function GET(){try{const count=await query<{count:string}>("SELECT COUNT(*)::text AS count FROM users");const user=await getCurrentUser();return Response.json({setupRequired:Number(count.rows[0].count)===0,user:user?{...user,roleLabel:roleLabels[user.role]}:null});}catch(e){return Response.json({error:e instanceof Error?e.message:"Lỗi kết nối dữ liệu"},{status:500});}}
