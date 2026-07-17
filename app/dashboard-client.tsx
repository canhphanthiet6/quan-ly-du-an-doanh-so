"use client";

import { FormEvent, useEffect, useState } from "react";

type User = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  mustChangePassword: boolean;
};

type Project = {
  id: number;
  code: string;
  name: string;
  contractor: string;
  product: string;
  owner_id: number;
  owner: string;
  probability: number;
  status: string;
  value: number;
  deadline: string;
  next_action: string;
  created_by: number;
};

type InventoryProduct = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sale_price: number;
  stock_qty: number;
  min_stock: number;
  peak_months: string;
  season_note: string;
  out_30d: number;
  in_30d: number;
  sales_status: string;
  suggested_qty: number;
};

type InventoryMovement = {
  id: number;
  product_name: string;
  sku: string;
  unit: string;
  movement_type: string;
  quantity: number;
  unit_price: number;
  movement_date: string;
  note: string;
  creator: string;
};

const VIEWS = [
  ["overview", "Tổng quan", "▦"],
  ["projects", "Đơn hàng", "▱"],
  ["inventory", "Kho hàng", "▥"],
  ["movements", "Xuất / nhập kho", "⇄"],
  ["reports", "Báo cáo công việc", "☷"],
  ["plans", "Kế hoạch tuần", "✓"],
  ["documents", "Công văn đi / đến", "▤"],
  ["events", "Lịch họp & công tác", "◷"],
  ["users", "Nhân sự", "♙"],
] as const;

const SEAFOOD_PRODUCTS = [
  "Cá nục",
  "Cá bạc má",
  "Cá ngừ",
  "Cá thu",
  "Mực ống",
  "Mực trứng",
  "Bạch tuộc",
  "Ghẹ",
  "Tôm",
  "Combo hải sản",
  "Nhiều loại hải sản",
];

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
const short = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(1).replace(".0", "") + " tỷ" : Math.round(n / 1e6) + " tr";
const stageLabel = (p: number) =>
  p === 100
    ? "Đã chốt đơn / 100%"
    : p === 80
      ? "Sắp chốt / 80%"
      : p === 50
        ? "Đang báo giá / 50%"
        : "Khách mới / 30%";

function isMonthInSeason(value: string, month = new Date().getMonth() + 1) {
  return String(value || "").split(/[;,]/).some((part) => {
    const token = part.trim();
    if (!token) return false;
    const range = token.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (!range) return Number(token) === month;
    const start = Number(range[1]);
    const end = Number(range[2]);
    return start <= end ? month >= start && month <= end : month >= start || month <= end;
  });
}

export default function Dashboard({ initialUser }: { initialUser: User }) {
  const [view, setView] = useState("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadCore = async () => {
    const [p, n, u, inventory, stockMoves] = await Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/notifications").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/inventory").then((r) => r.json()),
      fetch("/api/inventory/movements").then((r) => r.json()),
    ]);
    setProjects(p.projects || []);
    setNotes(n.notifications || []);
    setUsers(u.users || []);
    setProducts(inventory.products || []);
    setMovements(stockMoves.movements || []);
  };

  useEffect(() => {
    loadCore();
  }, []);

  useEffect(() => {
    if (["reports", "plans", "documents", "events"].includes(view)) {
      fetch("/api/modules/" + view)
        .then((r) => r.json())
        .then((d) => setItems(d.items || []));
    }
  }, [view]);

  const total = projects.reduce((sum, p) => sum + Number(p.value), 0);
  const weighted = projects.reduce((sum, p) => sum + (Number(p.value) * p.probability) / 100, 0);
  const closed = projects
    .filter((p) => p.probability === 100)
    .reduce((sum, p) => sum + Number(p.value), 0);
  const canEdit = (p: Project) =>
    initialUser.role === "director" || p.owner_id === initialUser.id || p.created_by === initialUser.id;
  const canManageStock = ["director", "admin", "accounting"].includes(initialUser.role);
  const stockAlerts = products.filter((p) => Number(p.stock_qty) <= Number(p.min_stock)).length;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    let url = "";
    let method = "POST";
    if (modal === "project") {
      url = editing ? "/api/projects/" + editing.id : "/api/projects";
      method = editing ? "PATCH" : "POST";
    } else if (modal === "product") {
      url = editingProduct ? "/api/inventory/" + editingProduct.id : "/api/inventory";
      method = editingProduct ? "PATCH" : "POST";
    } else if (modal === "movement") {
      url = "/api/inventory/movements";
    } else if (modal === "user") {
      url = "/api/users";
    } else {
      url = "/api/modules/" + modal;
    }
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Không thể lưu");
      return;
    }
    setModal(null);
    setEditing(null);
    setEditingProduct(null);
    await loadCore();
    if (["reports", "plans", "documents", "events"].includes(view)) {
      const refreshed = await fetch("/api/modules/" + view).then((r) => r.json());
      setItems(refreshed.items || []);
    }
  }

  return (
    <div className="portal">
      <aside>
        <div className="portal-brand">
          <b>H</b>
          <span>
            <strong>HẢI SẢN CẢNG</strong>
            <small>PHAN THIẾT · ĐIỀU HÀNH</small>
          </span>
        </div>
        <nav>
          {VIEWS.map(([id, label, icon]) => (
            <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}>
              <i>{icon}</i>
              {label}
              {id === "projects" && <em>{projects.length}</em>}
              {id === "inventory" && stockAlerts > 0 && <em className="alert-count">{stockAlerts}</em>}
            </button>
          ))}
        </nav>
        <div className="user-box">
          <div>{initialUser.fullName.split(" ").slice(-2).map((x) => x[0]).join("")}</div>
          <span>
            <b>{initialUser.fullName}</b>
            <small>
              {initialUser.role === "director"
                ? "Giám đốc"
                : initialUser.role === "admin"
                  ? "Admin"
                  : initialUser.role === "sales"
                    ? "Sales"
                    : initialUser.role === "accounting"
                      ? "Kế toán"
                      : "Hành chính"}
            </small>
          </span>
          <button onClick={logout}>↪</button>
        </div>
      </aside>

      <main className="portal-main">
        <header>
          <div>
            <h1>{VIEWS.find((x) => x[0] === view)?.[1]}</h1>
            <p>Cập nhật ngày {new Date().toLocaleDateString("vi-VN")}</p>
          </div>
          <button className="notify" onClick={() => setView("overview")}>
            ♢<b>{notes.length}</b>
          </button>
          {(!["inventory", "movements"].includes(view) || canManageStock) && (
            <button
              className="add"
              onClick={() => {
                setEditing(null);
                setEditingProduct(null);
                setModal(
                  view === "projects" || view === "overview"
                    ? "project"
                    : view === "inventory"
                      ? "product"
                      : view === "movements"
                        ? "movement"
                        : view === "users"
                          ? "user"
                          : view,
                );
              }}
            >
              ＋ Thêm mới
            </button>
          )}
        </header>

        {view === "overview" && (
          <>
            <section className="hero">
              <div>
                <small>BẢNG ĐIỀU HÀNH KINH DOANH</small>
                <h2>Chào anh {initialUser.fullName.split(" ").pop()}.</h2>
                <p>
                  Có <b>{notes.length} công việc</b> và <b>{stockAlerts} cảnh báo kho</b> cần lưu ý.
                </p>
              </div>
              <button onClick={() => setView("projects")}>Xem đơn hàng →</button>
            </section>
            <section className="stats">
              <article>
                <span>TỔNG GIÁ TRỊ ĐƠN HÀNG</span>
                <b>{short(total)}</b>
                <small>{projects.length} đơn hàng / cơ hội bán</small>
              </article>
              <article>
                <span>DOANH SỐ KỲ VỌNG</span>
                <b>{short(weighted)}</b>
                <small>Theo khả năng chốt đơn</small>
              </article>
              <article>
                <span>ĐÃ CHỐT ĐƠN</span>
                <b>{short(closed)}</b>
                <small>{projects.filter((p) => p.probability === 100).length} đơn hàng đã chốt</small>
              </article>
              <article>
                <span>CẦN XỬ LÝ</span>
                <b>{notes.length + stockAlerts} việc</b>
                <small>Công việc đến hạn và cảnh báo kho</small>
              </article>
            </section>
            <section className="overview-grid">
              <div className="panel">
                <div className="panel-title">
                  <h3>Phễu bán hàng</h3>
                  <span>Giá trị đơn hàng theo giai đoạn</span>
                </div>
                {[100, 80, 50, 30].map((value) => {
                  const sum = projects
                    .filter((p) => p.probability === value)
                    .reduce((acc, p) => acc + Number(p.value), 0);
                  return (
                    <div className="funnel" key={value}>
                      <b className={"s" + value}>{value}%</b>
                      <span>{stageLabel(value)}</span>
                      <i>
                        <u style={{ width: Math.max(3, total ? (sum / total) * 100 : 0) + "%" }} />
                      </i>
                      <strong>{short(sum)}</strong>
                    </div>
                  );
                })}
              </div>
              <div className="panel">
                <div className="panel-title">
                  <h3>Thông báo đến hạn</h3>
                  <span>Trong vòng 7 ngày</span>
                </div>
                <div className="notice-list">
                  {notes.length ? (
                    notes.slice(0, 8).map((n, i) => (
                      <div className={n.level} key={i}>
                        <b>{n.source}</b>
                        <span>
                          {n.title}
                          <small>
                            {n.owner} · {n.days < 0 ? "Quá hạn " + Math.abs(n.days) + " ngày" : n.days === 0 ? "Hạn hôm nay" : "Còn " + n.days + " ngày"}
                          </small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="empty">Không có công việc đến hạn.</p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {view === "projects" && (
          <section className="panel page-panel">
            <div className="panel-title">
              <div>
                <h3>Đơn hàng & cơ hội bán</h3>
                <span>Mỗi người chỉ chỉnh sửa đơn hàng của mình; Giám đốc quản lý toàn bộ</span>
              </div>
              <button onClick={() => setModal("project")}>＋ Thêm đơn hàng</button>
            </div>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>ĐƠN HÀNG / CƠ HỘI</th>
                    <th>KHÁCH HÀNG / SẢN PHẨM</th>
                    <th>PHỤ TRÁCH</th>
                    <th>GIAI ĐOẠN</th>
                    <th>GIÁ TRỊ</th>
                    <th>HẠN / BƯỚC TIẾP</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.name}</b>
                        <small>{p.code} · {p.status}</small>
                      </td>
                      <td>
                        {p.contractor}
                        <small>{p.product}</small>
                      </td>
                      <td>{p.owner}</td>
                      <td><mark className={"s" + p.probability}>{stageLabel(p.probability)}</mark></td>
                      <td><b>{money(Number(p.value))}</b></td>
                      <td>
                        {p.deadline ? new Date(p.deadline).toLocaleDateString("vi-VN") : "—"}
                        <small>{p.next_action}</small>
                      </td>
                      <td>
                        {canEdit(p) && (
                          <button onClick={() => { setEditing(p); setModal("project"); }}>Sửa</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === "inventory" && (
          <InventoryView
            products={products}
            canManage={canManageStock}
            onAdd={() => { setEditingProduct(null); setModal("product"); }}
            onEdit={(product) => { setEditingProduct(product); setModal("product"); }}
            onMovement={() => setModal("movement")}
          />
        )}

        {view === "movements" && (
          <MovementView movements={movements} canManage={canManageStock} onAdd={() => setModal("movement")} />
        )}

        {["reports", "plans", "documents", "events"].includes(view) && (
          <ModuleView kind={view} items={items} onAdd={() => setModal(view)} />
        )}
        {view === "users" && (
          <UsersView
            users={users}
            canAdd={["director", "admin"].includes(initialUser.role)}
            onAdd={() => setModal("user")}
          />
        )}
      </main>

      {modal && (
        <Modal
          kind={modal}
          editing={editing}
          editingProduct={editingProduct}
          users={users}
          products={products}
          director={initialUser.role === "director"}
          busy={busy}
          error={error}
          onClose={() => { setModal(null); setEditing(null); setEditingProduct(null); setError(""); }}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function InventoryView({ products, canManage, onAdd, onEdit, onMovement }: {
  products: InventoryProduct[];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (product: InventoryProduct) => void;
  onMovement: () => void;
}) {
  const currentMonth = new Date().getMonth() + 1;
  const outOfStock = products.filter((p) => Number(p.stock_qty) <= 0);
  const lowStock = products.filter((p) => Number(p.stock_qty) > 0 && Number(p.stock_qty) <= Number(p.min_stock));
  const inventoryValue = products.reduce((sum, p) => sum + Number(p.stock_qty) * Number(p.cost_price), 0);
  const recommended = products.filter((p) => Number(p.suggested_qty) > 0).slice(0, 6);
  const inSeason = products.filter((p) => isMonthInSeason(p.peak_months, currentMonth));
  const quantity = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value) || 0);

  return (
    <>
      <section className="inventory-stats">
        <article><span>MẶT HÀNG</span><b>{products.length}</b><small>Đang theo dõi trong kho</small></article>
        <article><span>GIÁ TRỊ TỒN KHO</span><b>{short(inventoryValue)}</b><small>Theo giá nhập gần nhất</small></article>
        <article className={outOfStock.length ? "danger-card" : ""}><span>HẾT HÀNG</span><b>{outOfStock.length}</b><small>Cần xử lý ngay</small></article>
        <article className={lowStock.length ? "warning-card" : ""}><span>SẮP HẾT</span><b>{lowStock.length}</b><small>Đã chạm mức tồn tối thiểu</small></article>
      </section>

      <section className="inventory-insights">
        <div className="panel insight-panel">
          <div className="panel-title"><div><h3>Đề xuất nên nhập</h3><span>Dựa trên lượng xuất 30 ngày, tồn hiện tại và mức tồn tối thiểu</span></div></div>
          <div className="recommend-list">
            {recommended.length ? recommended.map((p) => (
              <div key={p.id}><span><b>{p.name}</b><small>{p.sales_status} · Tồn {quantity(p.stock_qty)} {p.unit}</small></span><strong>Nhập khoảng {quantity(p.suggested_qty)} {p.unit}</strong></div>
            )) : <p className="empty">Chưa có mặt hàng nào cần nhập thêm.</p>}
          </div>
        </div>
        <div className="panel insight-panel">
          <div className="panel-title"><div><h3>Mùa ngon trong tháng {currentMonth}</h3><span>Thông tin do công ty thiết lập theo nguồn hàng thực tế</span></div></div>
          <div className="season-list">
            {inSeason.length ? inSeason.map((p) => <div key={p.id}><b>{p.name}</b><span>Tháng {p.peak_months}</span><small>{p.season_note || "Đang đúng mùa ngon đã thiết lập"}</small></div>) : <p className="empty">Chưa có dữ liệu mùa ngon tháng này. Hãy cập nhật mặt hàng.</p>}
          </div>
        </div>
      </section>

      <section className="panel page-panel inventory-panel">
        <div className="panel-title">
          <div><h3>Hàng tồn kho</h3><span>Hàng hết được tô đỏ; hàng sắp hết được tô vàng</span></div>
          {canManage && <div className="panel-actions"><button onClick={onMovement}>＋ Xuất / nhập</button><button onClick={onAdd}>＋ Thêm hàng hóa</button></div>}
        </div>
        <div className="data-table">
          <table>
            <thead><tr><th>HÀNG HÓA</th><th>TỒN KHO</th><th>GIÁ NHẬP / GIÁ BÁN</th><th>LÃI DỰ KIẾN</th><th>SỨC BÁN 30 NGÀY</th><th>MÙA BÉO NGON</th><th>ĐỀ XUẤT</th><th></th></tr></thead>
            <tbody>
              {products.map((p) => {
                const stock = Number(p.stock_qty);
                const minimum = Number(p.min_stock);
                const profit = Number(p.sale_price) - Number(p.cost_price);
                const margin = Number(p.sale_price) > 0 ? (profit / Number(p.sale_price)) * 100 : 0;
                const rowClass = stock <= 0 ? "stock-out" : stock <= minimum ? "stock-low" : "";
                const speedClass = p.sales_status === "Bán chạy" ? "speed-fast" : p.sales_status === "Bán chậm" ? "speed-slow" : "speed-normal";
                return (
                  <tr key={p.id} className={rowClass}>
                    <td><b>{p.name}</b><small>{p.sku} · {p.category} · ĐVT: {p.unit}</small></td>
                    <td><strong className="stock-number">{quantity(stock)} {p.unit}</strong><small>Tối thiểu {quantity(minimum)} {p.unit}</small>{stock <= 0 && <mark className="out-badge">HẾT HÀNG</mark>}</td>
                    <td>{money(Number(p.cost_price))}<small>Bán: {money(Number(p.sale_price))}</small></td>
                    <td><b>{money(profit)}</b><small>Biên lãi {margin.toFixed(1)}%</small></td>
                    <td><mark className={speedClass}>{p.sales_status}</mark><small>Đã xuất {quantity(p.out_30d)} {p.unit}</small></td>
                    <td>{p.peak_months ? <><b>Tháng {p.peak_months}</b>{isMonthInSeason(p.peak_months) && <mark className="season-now">ĐÚNG MÙA</mark>}<small>{p.season_note}</small></> : <span className="muted-text">Chưa cập nhật</span>}</td>
                    <td>{Number(p.suggested_qty) > 0 ? <b className="suggest-buy">Nên nhập {quantity(p.suggested_qty)} {p.unit}</b> : <span className="stock-ok">Tồn kho phù hợp</span>}</td>
                    <td>{canManage && <button onClick={() => onEdit(p)}>Sửa</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!products.length && <p className="empty">Chưa có hàng hóa. Bấm “Thêm hàng hóa” để thiết lập kho.</p>}
        </div>
      </section>
    </>
  );
}

function MovementView({ movements, canManage, onAdd }: { movements: InventoryMovement[]; canManage: boolean; onAdd: () => void }) {
  const quantity = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value) || 0);
  return (
    <section className="panel page-panel">
      <div className="panel-title"><div><h3>Lịch sử xuất / nhập kho</h3><span>Tất cả giao dịch nhập, xuất và điều chỉnh tồn kho</span></div>{canManage && <button onClick={onAdd}>＋ Tạo phiếu kho</button>}</div>
      <div className="data-table">
        <table>
          <thead><tr><th>NGÀY</th><th>LOẠI PHIẾU</th><th>HÀNG HÓA</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>THÀNH TIỀN</th><th>NGƯỜI TẠO / GHI CHÚ</th></tr></thead>
          <tbody>{movements.map((m) => {
            const isOut = m.movement_type === "Xuất" || m.movement_type === "Điều chỉnh giảm";
            return <tr key={m.id}><td>{new Date(m.movement_date).toLocaleDateString("vi-VN")}</td><td><mark className={isOut ? "move-out" : "move-in"}>{m.movement_type}</mark></td><td><b>{m.product_name}</b><small>{m.sku}</small></td><td><strong>{isOut ? "−" : "+"}{quantity(m.quantity)} {m.unit}</strong></td><td>{money(Number(m.unit_price))}</td><td><b>{money(Number(m.unit_price) * Number(m.quantity))}</b></td><td>{m.creator}<small>{m.note}</small></td></tr>;
          })}</tbody>
        </table>
        {!movements.length && <p className="empty">Chưa có giao dịch xuất nhập kho.</p>}
      </div>
    </section>
  );
}

function ModuleView({ kind, items, onAdd }: { kind: string; items: any[]; onAdd: () => void }) {
  const meta: any = {
    reports: ["Báo cáo công việc", ["Ngày", "Người báo cáo", "Khách hàng / Đơn hàng", "Nội dung", "Kết quả / Bước tiếp"]],
    plans: ["Kế hoạch tuần", ["Tuần", "Người phụ trách", "Công việc", "Hạn", "Trạng thái"]],
    documents: ["Công văn đi / đến", ["Loại", "Số công văn", "Trích yếu", "Đối tác", "Phụ trách", "Hạn"]],
    events: ["Lịch họp · Lịch hẹn · Công tác", ["Loại", "Thời gian", "Nội dung", "Địa điểm", "Phụ trách"]],
  };
  return (
    <section className="panel page-panel">
      <div className="panel-title">
        <div>
          <h3>{meta[kind][0]}</h3>
          <span>Dữ liệu dùng chung toàn công ty</span>
        </div>
        <button onClick={onAdd}>＋ Thêm mới</button>
      </div>
      <div className="data-table">
        <table>
          <thead><tr>{meta[kind][1].map((x: string) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                {kind === "reports" ? (
                  <><td>{new Date(x.report_date).toLocaleDateString("vi-VN")}</td><td>{x.owner}</td><td>{x.customer}<small>{x.project_name}</small></td><td>{x.content}</td><td>{x.result}<small>{x.next_action}</small></td></>
                ) : kind === "plans" ? (
                  <><td>{new Date(x.week_start).toLocaleDateString("vi-VN")}</td><td>{x.owner}</td><td>{x.title}<small>{x.detail}</small></td><td>{x.due_date ? new Date(x.due_date).toLocaleDateString("vi-VN") : "—"}</td><td>{x.status}</td></>
                ) : kind === "documents" ? (
                  <><td><mark>{x.direction}</mark></td><td>{x.document_no}</td><td>{x.subject}</td><td>{x.partner}</td><td>{x.owner}</td><td>{x.due_date ? new Date(x.due_date).toLocaleDateString("vi-VN") : "—"}</td></>
                ) : (
                  <><td><mark>{x.event_type}</mark></td><td>{new Date(x.start_at).toLocaleString("vi-VN")}</td><td>{x.title}</td><td>{x.location}</td><td>{x.owner}</td></>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="empty">Chưa có dữ liệu. Bấm “Thêm mới” để bắt đầu.</p>}
      </div>
    </section>
  );
}

function UsersView({ users, canAdd, onAdd }: { users: any[]; canAdd: boolean; onAdd: () => void }) {
  return (
    <section className="panel page-panel">
      <div className="panel-title">
        <div>
          <h3>Nhân sự & phân quyền</h3>
          <span>Dự kiến 6 tài khoản: 1 Giám đốc, 1 Admin, 2 Sales, 1 Kế toán, 1 Hành chính</span>
        </div>
        {canAdd && <button onClick={onAdd}>＋ Tạo tài khoản</button>}
      </div>
      <div className="people-grid">
        {users.map((u) => (
          <article key={u.id}>
            <i>{u.full_name.split(" ").slice(-2).map((x: string) => x[0]).join("")}</i>
            <div>
              <b>{u.full_name}</b>
              <span>@{u.username}</span>
              <mark>{u.role_label}</mark>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Modal({ kind, editing, editingProduct, users, products, director, busy, error, onClose, onSubmit }: {
  kind: string;
  editing: Project | null;
  editingProduct: InventoryProduct | null;
  users: any[];
  products: InventoryProduct[];
  director: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  const title: any = {
    project: editing ? "Cập nhật đơn hàng" : "Thêm đơn hàng",
    product: editingProduct ? "Cập nhật hàng hóa" : "Thêm hàng hóa",
    movement: "Tạo phiếu xuất / nhập kho",
    reports: "Báo cáo công việc",
    plans: "Kế hoạch tuần",
    documents: "Thêm công văn",
    events: "Thêm lịch công việc",
    user: "Tạo tài khoản",
  };
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="portal-modal" onSubmit={onSubmit}>
        <div>
          <small>HẢI SẢN CẢNG PHAN THIẾT</small>
          <h2>{title[kind]}</h2>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <div className="modal-fields">
          {kind === "project" ? (
            <>
              <label className="wide">Tên đơn hàng / cơ hội bán<input name="name" required defaultValue={editing?.name} placeholder="VD: Đơn cá nục cho quán A" /></label>
              <label>Mã đơn hàng<input name="code" required defaultValue={editing?.code || "DH-2026-"} /></label>
              <label>Giá trị dự kiến<input name="value" type="number" min="0" defaultValue={editing?.value || 0} /></label>
              <label>Khách hàng / kênh bán<input name="contractor" defaultValue={editing?.contractor} placeholder="Khách lẻ, quán ăn, nhóm mua..." /></label>
              <label>Sản phẩm hải sản<input name="product" list="seafood-products" defaultValue={editing?.product} placeholder="Chọn hoặc nhập sản phẩm" /><datalist id="seafood-products">{SEAFOOD_PRODUCTS.map((product) => <option key={product} value={product} />)}</datalist></label>
              <label>Giai đoạn bán hàng<select name="probability" defaultValue={editing?.probability || 30}><option value="30">Khách mới / Quan tâm — 30%</option><option value="50">Đang báo giá — 50%</option><option value="80">Sắp chốt — 80%</option><option value="100">Đã chốt đơn — 100%</option></select></label>
              {director && <label>Phân công<select name="ownerId" defaultValue={editing?.owner_id}>{users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>}
              <label>Trạng thái<select name="status" defaultValue={editing?.status || "Khách mới / Quan tâm"}><option>Khách mới / Quan tâm</option><option>Đang báo giá</option><option>Chờ khách xác nhận</option><option>Đã chốt đơn</option><option>Đang chuẩn bị hàng</option><option>Đang giao hàng</option><option>Hoàn thành</option><option>Hủy</option></select></label>
              <label>Hạn xử lý / ngày giao<input name="deadline" type="date" defaultValue={editing?.deadline?.slice(0, 10)} /></label>
              <label className="wide">Bước tiếp theo<input name="nextAction" defaultValue={editing?.next_action} placeholder="Gọi xác nhận, chuẩn bị hàng, giao hàng..." /></label>
            </>
          ) : kind === "product" ? (
            <>
              <label>Mã hàng<input name="sku" required defaultValue={editingProduct?.sku || "HS-"} placeholder="VD: HS-MUC-01" /></label>
              <label>Tên hàng<input name="name" list="inventory-seafood-products" required defaultValue={editingProduct?.name} placeholder="Cá, mực, bạch tuộc, ghẹ..." /><datalist id="inventory-seafood-products">{SEAFOOD_PRODUCTS.map((product) => <option key={product} value={product} />)}</datalist></label>
              <label>Nhóm hàng<select name="category" defaultValue={editingProduct?.category || "Hải sản tươi"}><option>Hải sản tươi</option><option>Cá</option><option>Mực & bạch tuộc</option><option>Tôm & ghẹ</option><option>Combo hải sản</option><option>Khác</option></select></label>
              <label>Đơn vị tính<select name="unit" defaultValue={editingProduct?.unit || "kg"}><option>kg</option><option>con</option><option>thùng</option><option>khay</option><option>combo</option></select></label>
              <label>Giá nhập<input name="costPrice" type="number" min="0" required defaultValue={Number(editingProduct?.cost_price || 0)} /></label>
              <label>Giá bán<input name="salePrice" type="number" min="0" required defaultValue={Number(editingProduct?.sale_price || 0)} /></label>
              {!editingProduct && <label>Tồn đầu kỳ<input name="initialStock" type="number" min="0" step="0.001" defaultValue="0" /></label>}
              <label>Mức tồn tối thiểu<input name="minStock" type="number" min="0" step="0.001" defaultValue={Number(editingProduct?.min_stock || 0)} /></label>
              <label className="wide">Tháng béo ngon nhất<input name="peakMonths" defaultValue={editingProduct?.peak_months} placeholder="VD: 3-5, 9, 11-1" /><small>Nhập số tháng hoặc khoảng tháng, cách nhau bằng dấu phẩy.</small></label>
              <label className="wide">Ghi chú mùa vụ<textarea name="seasonNote" defaultValue={editingProduct?.season_note} placeholder="VD: Cá béo, thịt chắc; ưu tiên nguồn ghe về sáng..." /></label>
            </>
          ) : kind === "movement" ? (
            <>
              <label>Loại phiếu<select name="movementType"><option>Nhập</option><option>Xuất</option><option>Điều chỉnh tăng</option><option>Điều chỉnh giảm</option></select></label>
              <label>Ngày xuất / nhập<input name="movementDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              <label className="wide">Hàng hóa<select name="productId" required defaultValue=""><option value="" disabled>Chọn hàng hóa</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — tồn {Number(product.stock_qty).toLocaleString("vi-VN")} {product.unit}</option>)}</select></label>
              <label>Số lượng<input name="quantity" type="number" min="0.001" step="0.001" required /></label>
              <label>Đơn giá nhập / bán<input name="unitPrice" type="number" min="0" defaultValue="0" /></label>
              <label className="wide">Ghi chú<input name="note" placeholder="Nhà cung cấp, khách hàng, số đơn..." /></label>
              {!products.length && <div className="form-hint wide">Cần tạo ít nhất một hàng hóa trước khi lập phiếu kho.</div>}
            </>
          ) : kind === "reports" ? (
            <>
              <label>Ngày báo cáo<input name="reportDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              <label>Khách hàng<input name="customer" /></label>
              <label className="wide">Đơn hàng / Công việc<input name="projectName" /></label>
              <label className="wide">Nội dung đã làm<textarea name="content" required /></label>
              <label>Kết quả<input name="result" /></label>
              <label>Bước tiếp theo<input name="nextAction" /></label>
              <label>Hạn xử lý<input name="dueDate" type="date" /></label>
            </>
          ) : kind === "plans" ? (
            <>
              <label>Tuần bắt đầu<input name="weekStart" type="date" required /></label>
              <label>Hạn hoàn thành<input name="dueDate" type="date" /></label>
              <label className="wide">Công việc kế hoạch<input name="title" required /></label>
              <label className="wide">Chi tiết<textarea name="detail" /></label>
              <label>Trạng thái<select name="status"><option>Chưa thực hiện</option><option>Đang thực hiện</option><option>Hoàn thành</option></select></label>
            </>
          ) : kind === "documents" ? (
            <>
              <label>Loại công văn<select name="direction"><option>Đến</option><option>Đi</option></select></label>
              <label>Số công văn<input name="documentNo" /></label>
              <label className="wide">Trích yếu / Nội dung<input name="subject" required /></label>
              <label>Cơ quan / Đối tác<input name="partner" /></label>
              <label>Ngày văn bản<input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
              <label>Hạn xử lý<input name="dueDate" type="date" /></label>
              <label className="wide">Ghi chú<textarea name="notes" /></label>
            </>
          ) : kind === "events" ? (
            <>
              <label>Loại lịch<select name="eventType"><option>Họp</option><option>Lịch hẹn</option><option>Công tác</option></select></label>
              <label>Thời gian bắt đầu<input name="startAt" type="datetime-local" required /></label>
              <label className="wide">Nội dung<input name="title" required /></label>
              <label>Địa điểm<input name="location" /></label>
              <label>Người tham dự<input name="participants" /></label>
              <label className="wide">Ghi chú<textarea name="notes" /></label>
            </>
          ) : (
            <>
              <label>Họ và tên<input name="fullName" required /></label>
              <label>Tên đăng nhập<input name="username" required /></label>
              <label>Vai trò<select name="role"><option value="sales">Sales</option><option value="accounting">Kế toán</option><option value="hr">Hành chính</option><option value="admin">Admin</option><option value="director">Giám đốc</option></select></label>
              <label>Mật khẩu tạm<input name="password" minLength={6} required /></label>
            </>
          )}
        </div>
        {error && <div className="form-error">{error}</div>}
        <footer>
          <button type="button" onClick={onClose}>Hủy</button>
          <button className="save" disabled={busy}>{busy ? "Đang lưu..." : "Lưu thông tin"}</button>
        </footer>
      </form>
    </div>
  );
}
