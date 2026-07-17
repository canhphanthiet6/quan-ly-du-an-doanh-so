import { asc } from "drizzle-orm";
import { getDb } from "../../../db";
import { projects } from "../../../db/schema";

const seed = [
  {code:"DA-2026-018",name:"Tuyến ống cấp nước KCN VSIP",contractor:"Công ty CP Xây dựng An Phát",product:"Ống gang dẻo DN600",owner:"Nguyễn Văn Minh",probability:100,status:"Đã ký hợp đồng",value:12680000000,deadline:"2026-08-15",nextAction:"Chuẩn bị giao hàng"},
  {code:"DA-2026-021",name:"Cải tạo mạng lưới cấp nước Quận 9",contractor:"SAWACO",product:"Đồng hồ nước & phụ kiện",owner:"Trần Thu Hà",probability:80,status:"Đã gửi báo giá",value:8450000000,deadline:"2026-07-20",nextAction:"Theo dõi phê duyệt"},
  {code:"DA-2026-024",name:"Nhà máy nước Nhơn Trạch GĐ2",contractor:"Tổng công ty CP Vinaconex",product:"Van chặn & phụ kiện gang",owner:"Nguyễn Văn Minh",probability:80,status:"Đàm phán kỹ thuật",value:6390000000,deadline:"2026-07-16",nextAction:"Gửi hồ sơ kỹ thuật"},
  {code:"DA-2026-027",name:"Mở rộng cấp nước KCN Long Hậu",contractor:"Công ty CP Long Hậu",product:"Ống gang dẻo DN300–500",owner:"Lê Hoàng Nam",probability:50,status:"Đang tiếp cận",value:5200000000,deadline:"2026-07-25",nextAction:"Gặp chủ đầu tư"},
  {code:"DA-2026-029",name:"Hệ thống cấp nước đô thị Cần Thơ",contractor:"Ban QLDA ĐTXD Cần Thơ",product:"Đồng hồ tổng DN150",owner:"Trần Thu Hà",probability:50,status:"Chuẩn bị hồ sơ",value:3780000000,deadline:"2026-07-15",nextAction:"Hoàn thiện catalogue"},
  {code:"DA-2026-031",name:"Tuyến ống truyền tải Bình Dương",contractor:"Biwase",product:"Ống gang & phụ kiện DN800",owner:"Nguyễn Hữu Cảnh",probability:50,status:"Tìm hiểu nhu cầu",value:9100000000,deadline:"2026-08-05",nextAction:"Xác nhận khối lượng"},
];

export async function GET(){
  try{const db=await getDb();let rows=await db.select().from(projects).orderBy(asc(projects.id));if(!rows.length){await db.insert(projects).values(seed);rows=await db.select().from(projects).orderBy(asc(projects.id));}return Response.json({projects:rows});}
  catch(error){return Response.json({error:error instanceof Error?error.message:"Lỗi dữ liệu"},{status:500});}
}
export async function POST(request:Request){
  try{const p=await request.json() as typeof seed[number];if(!p.name||!p.code||!p.contractor||!p.value)return Response.json({error:"Thiếu thông tin bắt buộc"},{status:400});const db=await getDb();const [row]=await db.insert(projects).values({...p,status:p.status||"Đang tiếp cận"}).returning();return Response.json({project:row},{status:201});}
  catch(error){return Response.json({error:error instanceof Error?error.message:"Lỗi dữ liệu"},{status:500});}
}
