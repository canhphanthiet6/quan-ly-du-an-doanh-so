"use client";

import { useEffect, useMemo, useState } from "react";

type Project = {
  id: number; code: string; name: string; contractor: string; product: string;
  owner: string; probability: number; status: string; value: number;
  deadline: string; nextAction: string;
};

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
const shortMoney = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(1).replace(".0", "")} tỷ` : `${Math.round(n / 1e6)} tr`;
const today = new Date("2026-07-17T00:00:00");

const icons: Record<string, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  folder: <><path d="M3 6h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9h18"/></>,
  chart: <><path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/></>,
  users: <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 3.5a4 4 0 0 1 0 9"/><path d="M18 15a6 6 0 0 1 4 6"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
};
function Icon({name, size=20}:{name:string,size?:number}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg> }

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Tất cả");
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({code:"DA-2026-",name:"",contractor:"",product:"Ống gang dẻo",owner:"Nguyễn Văn Minh",probability:"50",status:"Đang tiếp cận",value:"",deadline:"2026-08-31",nextAction:""});

  const load = async () => {
    try { const r = await fetch("/api/projects"); const d = await r.json(); setProjects(d.projects || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => projects.filter(p => {
    const q = query.toLowerCase();
    return (!q || `${p.code} ${p.name} ${p.contractor} ${p.owner}`.toLowerCase().includes(q)) && (filter === "Tất cả" || p.probability === Number(filter));
  }), [projects, query, filter]);
  const total = projects.reduce((s,p)=>s+p.value,0);
  const weighted = projects.reduce((s,p)=>s+p.value*p.probability/100,0);
  const signed = projects.filter(p=>p.status==="Đã ký hợp đồng").reduce((s,p)=>s+p.value,0);
  const target = 45_000_000_000;
  const overdue = projects.filter(p=>new Date(p.deadline)<today && p.status!=="Đã ký hợp đồng").length;

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/projects", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...form,probability:Number(form.probability),value:Number(form.value)})});
    if(r.ok){ setOpen(false); setToast("Đã thêm dự án mới"); await load(); setTimeout(()=>setToast(""),2500); }
  }

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brandmark">V</div><div><b>VIET WATER</b><span>PROJECT HUB</span></div></div>
      <nav>
        <a className="active"><Icon name="grid"/>Tổng quan</a>
        <a><Icon name="folder"/>Dự án <em>{projects.length}</em></a>
        <a><Icon name="chart"/>Doanh số</a>
        <a><Icon name="target"/>Kế hoạch</a>
        <a><Icon name="users"/>Nhân sự</a>
      </nav>
      <div className="side-note"><span>MỤC TIÊU 2026</span><b>{shortMoney(target)}</b><div><i style={{width:`${Math.min(100,signed/target*100)}%`}}/></div><small>Đã đạt {Math.round(signed/target*100)}%</small></div>
      <div className="profile"><div>NC</div><p><b>Nguyễn Hữu Cảnh</b><span>Quản trị viên</span></p><button aria-label="Mở cài đặt">•••</button></div>
    </aside>

    <main>
      <header><button className="mobile-brand">V</button><div><h1>Tổng quan dự án</h1><p>Thứ Sáu, 17 tháng 7, 2026</p></div><div className="head-actions"><label className="search"><span>⌕</span><input aria-label="Tìm kiếm" placeholder="Tìm dự án, nhà thầu..." value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="bell" aria-label="Thông báo">♧<i>{overdue}</i></button><button className="primary" onClick={()=>setOpen(true)}>＋ Thêm dự án</button></div></header>

      <section className="welcome"><div><span>BÁO CÁO KINH DOANH</span><h2>Chào buổi sáng, anh Cảnh.</h2><p>Công ty đang theo dõi <b>{projects.length} dự án</b>. Có <b>{overdue} công việc quá hạn</b> cần xử lý hôm nay.</p></div><button onClick={()=>document.getElementById("projects")?.scrollIntoView({behavior:"smooth"})}>Xem danh sách dự án <b>→</b></button></section>

      <section className="metrics">
        <article><div className="metric-icon blue"><Icon name="folder"/></div><div><span>TỔNG GIÁ TRỊ DỰ ÁN</span><b>{shortMoney(total)}</b><small><i>↑ 12,5%</i> so với tháng trước</small></div></article>
        <article><div className="metric-icon teal"><Icon name="target"/></div><div><span>DOANH SỐ KỲ VỌNG</span><b>{shortMoney(weighted)}</b><small>Theo xác suất thành công</small></div></article>
        <article><div className="metric-icon gold"><Icon name="chart"/></div><div><span>ĐÃ KÝ HỢP ĐỒNG</span><b>{shortMoney(signed)}</b><small><i>{projects.filter(p=>p.status==="Đã ký hợp đồng").length} dự án</i> đã chốt</small></div></article>
        <article><div className="metric-icon red">!</div><div><span>CẦN XỬ LÝ</span><b>{overdue} việc</b><small className="danger">Đã quá hạn kế hoạch</small></div></article>
      </section>

      <section className="content-grid">
        <div className="card pipeline"><div className="card-head"><div><h3>Phễu dự án</h3><p>Giá trị theo khả năng thành công</p></div><button>Chi tiết ↗</button></div>
          {[100,80,50].map((v,i)=>{const sum=projects.filter(p=>p.probability===v).reduce((s,p)=>s+p.value,0);const count=projects.filter(p=>p.probability===v).length;return <div className="pipe-row" key={v}><div><span className={`dot d${i}`}/><b>{v}%</b><small>{v===100?"Chắc chắn / Đã ký":v===80?"Khả năng cao":"Đang theo dõi"}</small></div><div className="bar"><i className={`b${i}`} style={{width:`${Math.max(8,sum/Math.max(total,1)*230)}%`}}/></div><b>{shortMoney(sum)}</b><em>{count} dự án</em></div>})}
          <div className="forecast"><span>DOANH SỐ DỰ KIẾN CÓ TRỌNG SỐ</span><b>{money(weighted)}</b></div>
        </div>
        <div className="card goal"><div className="card-head"><div><h3>Mục tiêu doanh số</h3><p>Tiến độ năm 2026</p></div><select aria-label="Chọn năm"><option>2026</option></select></div><div className="goal-body"><div className="donut" style={{background:`conic-gradient(#0b7189 ${Math.min(100,signed/target*100)}%, #e8eef0 0)`}}><div><b>{Math.round(signed/target*100)}%</b><span>ĐÃ ĐẠT</span></div></div><div className="goal-copy"><span>MỤC TIÊU</span><b>{money(target)}</b><span>ĐÃ THỰC HIỆN</span><strong>{money(signed)}</strong><small>Còn thiếu {money(Math.max(0,target-signed))}</small></div></div></div>
      </section>

      <section className="card project-card" id="projects"><div className="card-head project-head"><div><h3>Danh sách dự án đang theo dõi</h3><p>Cập nhật mới nhất từ đội ngũ kinh doanh</p></div><div className="filters">{["Tất cả","100","80","50"].map(x=><button className={filter===x?"selected":""} onClick={()=>setFilter(x)} key={x}>{x==="Tất cả"?x:x+"%"}</button>)}</div></div>
        <div className="table-wrap"><table><thead><tr><th>DỰ ÁN</th><th>NHÀ THẦU / SẢN PHẨM</th><th>PHỤ TRÁCH</th><th>KHẢ NĂNG</th><th>GIÁ TRỊ HỢP ĐỒNG</th><th>BƯỚC TIẾP THEO</th><th></th></tr></thead><tbody>{loading?<tr><td colSpan={7} className="empty">Đang tải dữ liệu...</td></tr>:filtered.map(p=>{const late=new Date(p.deadline)<today&&p.status!=="Đã ký hợp đồng";return <tr key={p.id}><td><b className="project-name">{p.name}</b><span>{p.code} · {p.status}</span></td><td><b>{p.contractor}</b><span>{p.product}</span></td><td><div className="owner"><i>{p.owner.split(" ").slice(-2).map(x=>x[0]).join("")}</i><span>{p.owner}</span></div></td><td><span className={`chance c${p.probability}`}>{p.probability}%</span></td><td><b>{money(p.value)}</b></td><td><b>{p.nextAction}</b><span className={late?"late":""}>{late?"Quá hạn · ":"Hạn: "}{new Date(p.deadline).toLocaleDateString("vi-VN")}</span></td><td><button className="more">•••</button></td></tr>})}</tbody></table></div>
        <div className="table-foot"><span>Hiển thị {filtered.length} trong {projects.length} dự án</span><button>Xem tất cả dự án →</button></div>
      </section>
    </main>

    {open&&<div className="modal-bg" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><form className="modal" onSubmit={addProject}><div className="modal-head"><div><span>DỰ ÁN MỚI</span><h2>Thêm dự án vào kế hoạch</h2></div><button type="button" onClick={()=>setOpen(false)}>×</button></div><div className="form-grid">
      <label className="wide">Tên dự án<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="VD: Tuyến ống cấp nước KCN..."/></label>
      <label>Mã dự án<input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Giá trị dự kiến<input required type="number" min="0" value={form.value} onChange={e=>setForm({...form,value:e.target.value})} placeholder="2500000000"/></label>
      <label>Nhà thầu / Chủ đầu tư<input required value={form.contractor} onChange={e=>setForm({...form,contractor:e.target.value})}/></label><label>Sản phẩm<select value={form.product} onChange={e=>setForm({...form,product:e.target.value})}><option>Ống gang dẻo</option><option>Phụ kiện gang</option><option>Đồng hồ nước</option><option>Van ngành nước</option></select></label>
      <label>Người phụ trách<select value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}><option>Nguyễn Văn Minh</option><option>Trần Thu Hà</option><option>Nguyễn Hữu Cảnh</option><option>Lê Hoàng Nam</option></select></label><label>Khả năng thành công<select value={form.probability} onChange={e=>setForm({...form,probability:e.target.value})}><option value="50">50% — Đang theo dõi</option><option value="80">80% — Khả năng cao</option><option value="100">100% — Chắc chắn</option></select></label>
      <label>Hạn xử lý<input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></label><label>Bước tiếp theo<input value={form.nextAction} onChange={e=>setForm({...form,nextAction:e.target.value})} placeholder="Gửi báo giá, gặp CĐT..."/></label>
    </div><div className="modal-actions"><button type="button" onClick={()=>setOpen(false)}>Hủy</button><button className="primary" type="submit">Lưu dự án</button></div></form></div>}
    {toast&&<div className="toast">✓ {toast}</div>}
  </div>;
}
