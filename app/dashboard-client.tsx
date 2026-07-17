"use client";

import { FormEvent, useEffect, useState } from "react";

type User = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  mustChangePassword: boolean;
};

type ProjectItem = {
  id: number;
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  price_date: string;
  line_total: number;
};

type Project = {
  id: number;
  code: string;
  name: string;
  contractor: string;
  customer_phone: string;
  customer_type: string;
  sales_channel: string;
  customer_id: number;
  product: string;
  owner_id: number;
  owner: string;
  probability: number;
  status: string;
  value: number;
  deadline: string;
  next_action: string;
  created_by: number;
  items: ProjectItem[];
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

type Customer = {
  id: number;
  name: string;
  phone: string;
  customer_type: string;
  sales_channel: string;
  contact_count: number;
  first_contact_at: string;
  last_contact_at: string;
  owner: string;
  quote_count: number;
  signed_count: number;
  signed_revenue: number;
  created_at: string;
};

type Contract = {
  id: number;
  contract_no: string;
  project_id: number;
  project_name: string;
  customer_name: string;
  customer_phone: string;
  title: string;
  contract_value: number;
  signed_date: string;
  status: string;
  salesperson_id: number;
  salesperson: string;
  notes: string;
  creator: string;
};

type SalesSummary = { id: number; full_name: string; role: string; signed_count: number; revenue: number };

type ChannelPerformance = {
  sales_channel: string;
  quote_count: number;
  customer_count: number;
  expected_value: number;
  signed_count: number;
  revenue: number;
};

const VIEWS = [
  ["overview", "Tổng quan", "▦"],
  ["projects", "Đơn hàng", "▱"],
  ["customers", "Data khách hàng", "♧"],
  ["channels", "Kênh bán hàng", "◫"],
  ["contracts", "Hợp đồng", "▣"],
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
  "Cá bã trầu",
  "Cá ngừ",
  "Cá thu",
  "Bạch tuộc",
  "Mực ống",
  "Mực trứng",
  "Mực khô",
  "Mực 1 nắng",
  "Ghẹ",
  "Tôm",
  "Combo hải sản",
  "Nhiều loại hải sản",
];

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫";
const dateTime = (value: string) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary[]>([]);
  const [channelMonth, setChannelMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [channelPerformance, setChannelPerformance] = useState<ChannelPerformance[]>([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const loadCore = async () => {
    const [p, n, u, inventory, stockMoves, customerData, contractData] = await Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/notifications").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/inventory").then((r) => r.json()),
      fetch("/api/inventory/movements").then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/contracts").then((r) => r.json()),
    ]);
    setProjects(p.projects || []);
    setNotes(n.notifications || []);
    setUsers(u.users || []);
    setProducts(inventory.products || []);
    setMovements(stockMoves.movements || []);
    setCustomers(customerData.customers || []);
    setContracts(contractData.contracts || []);
    setSalesSummary(contractData.salesSummary || []);
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

  useEffect(() => {
    if (view !== "channels") return;
    setChannelLoading(true);
    fetch(`/api/channels?month=${encodeURIComponent(channelMonth)}`)
      .then((response) => response.json())
      .then((data) => setChannelPerformance(data.channels || []))
      .finally(() => setChannelLoading(false));
  }, [view, channelMonth]);

  const total = projects.reduce((sum, p) => sum + Number(p.value), 0);
  const weighted = projects.reduce((sum, p) => sum + (Number(p.value) * p.probability) / 100, 0);
  const signedRevenue = contracts
    .filter((contract) => contract.status === "Đã ký")
    .reduce((sum, contract) => sum + Number(contract.contract_value), 0);
  const canEdit = (p: Project) =>
    initialUser.role === "director" || p.owner_id === initialUser.id || p.created_by === initialUser.id;
  const canManageStock = ["director", "admin", "accounting"].includes(initialUser.role);
  const stockAlerts = products.filter((p) => Number(p.stock_qty) <= Number(p.min_stock)).length;
  const pendingContracts = contracts.filter((contract) => contract.status === "Chờ duyệt").length;
  const actionAlerts = notes.length + stockAlerts + pendingContracts;

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
    } else if (modal === "contract") {
      url = editingContract ? "/api/contracts/" + editingContract.id : "/api/contracts";
      method = editingContract ? "PATCH" : "POST";
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
    if (modal === "project" && !editing && data.customerInfo?.isExisting) {
      setFlash(`Khách cũ ${data.project?.contractor || ""} đã quay lại lần ${data.customerInfo.returnNumber}. Hồ sơ đã được cập nhật trong Data khách hàng.`);
    } else if (modal === "contract" && (data.contract?.status === "Đã ký" || editingContract)) {
      setFlash("Hợp đồng đã được cập nhật. Doanh số của người bán được tự động tính lại.");
    }
    setModal(null);
    setEditing(null);
    setEditingProduct(null);
    setEditingContract(null);
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
              {id === "customers" && <em>{customers.length}</em>}
              {id === "contracts" && contracts.filter((c) => c.status === "Chờ duyệt").length > 0 && <em className="alert-count">{contracts.filter((c) => c.status === "Chờ duyệt").length}</em>}
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
            ♢<b>{actionAlerts}</b>
          </button>
          {!["customers", "channels"].includes(view) && (!["inventory", "movements"].includes(view) || canManageStock) && (
            <button
              className="add"
              onClick={() => {
                setEditing(null);
                setEditingProduct(null);
                setEditingContract(null);
                setModal(
                  view === "projects" || view === "overview"
                    ? "project"
                    : view === "inventory"
                      ? "product"
                      : view === "movements"
                      ? "movement"
                      : view === "contracts"
                        ? "contract"
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

        {flash && <div className="flash-message"><span>✓</span>{flash}<button onClick={() => setFlash("")}>×</button></div>}

        {view === "overview" && (
          <>
            <section className="hero">
              <div>
                <small>BẢNG ĐIỀU HÀNH KINH DOANH</small>
                <h2>Chào anh {initialUser.fullName.split(" ").pop()}.</h2>
                <p>
                  Có <b>{notes.length} công việc</b>, <b>{stockAlerts} cảnh báo kho</b> và <b>{pendingContracts} hợp đồng chờ duyệt</b>.
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
                <span>HỢP ĐỒNG ĐÃ KÝ</span>
                <b>{short(signedRevenue)}</b>
                <small>{contracts.filter((contract) => contract.status === "Đã ký").length} hợp đồng đã ghi doanh số</small>
              </article>
              <article>
                <span>CẦN XỬ LÝ</span>
                <b>{actionAlerts} việc</b>
                <small>Việc đến hạn, kho và hợp đồng chờ duyệt</small>
              </article>
            </section>
            <section className="overview-grid">
              <div className="panel">
                <div className="panel-title">
                  <div>
                    <h3>Phễu bán hàng</h3>
                    <span>Giá trị đơn hàng theo giai đoạn</span>
                  </div>
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
                  <div>
                    <h3>Thông báo đến hạn</h3>
                    <span>Trong vòng 7 ngày</span>
                  </div>
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
                    <th>KHÁCH HÀNG</th>
                    <th>KÊNH BÁN HÀNG</th>
                    <th>SẢN PHẨM</th>
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
                        <small>{p.customer_phone} · {p.customer_type}</small>
                      </td>
                      <td><mark>{p.sales_channel}</mark></td>
                      <td>
                        <b>{p.items?.length ? `${p.items.length} mặt hàng` : p.product || "—"}</b>
                        {p.items?.length > 0 && <small>{p.items.map((item) => `${item.product_name}: ${Number(item.quantity).toLocaleString("vi-VN")} ${item.unit}`).join(" · ")}</small>}
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

        {view === "customers" && <CustomersView customers={customers} />}

        {view === "channels" && (
          <ChannelView
            month={channelMonth}
            channels={channelPerformance}
            loading={channelLoading}
            onMonthChange={setChannelMonth}
          />
        )}

        {view === "contracts" && (
          <ContractsView
            contracts={contracts}
            salesSummary={salesSummary}
            director={initialUser.role === "director"}
            onAdd={() => { setEditingContract(null); setModal("contract"); }}
            onEdit={(contract) => { setEditingContract(contract); setModal("contract"); }}
          />
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
          editingContract={editingContract}
          users={users}
          products={products}
          projects={projects}
          director={initialUser.role === "director"}
          busy={busy}
          error={error}
          onClose={() => { setModal(null); setEditing(null); setEditingProduct(null); setEditingContract(null); setError(""); }}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function CustomersView({ customers }: { customers: Customer[] }) {
  const returning = customers.filter((c) => Number(c.contact_count) > 1).length;
  const totalRevenue = customers.reduce((sum, c) => sum + Number(c.signed_revenue), 0);
  return (
    <>
      <section className="customer-stats">
        <article><span>TỔNG KHÁCH HÀNG</span><b>{customers.length}</b><small>Tự động lấy từ báo giá / đơn hàng</small></article>
        <article><span>KHÁCH QUAY LẠI</span><b>{returning}</b><small>Có từ 2 lần liên hệ trở lên</small></article>
        <article><span>DOANH SỐ ĐÃ KÝ</span><b>{short(totalRevenue)}</b><small>Tổng hợp từ hợp đồng</small></article>
      </section>
      <section className="panel page-panel customer-panel">
        <div className="panel-title"><div><h3>Data khách hàng</h3><span>Khách tự động được tạo khi nhập báo giá hoặc đơn hàng mới</span></div></div>
        <div className="data-table">
          <table>
            <thead><tr><th>KHÁCH HÀNG</th><th>NGÀY LƯU DATA</th><th>PHÂN LOẠI</th><th>KÊNH BÁN</th><th>LẦN LIÊN HỆ</th><th>ĐƠN / BÁO GIÁ</th><th>HỢP ĐỒNG</th><th>DOANH SỐ</th><th>SALE PHỤ TRÁCH</th><th>LẦN GẦN NHẤT</th></tr></thead>
            <tbody>{customers.map((c) => <tr key={c.id} className={Number(c.contact_count) > 1 ? "returning-customer" : ""}>
              <td><b>{c.name}</b><small>{c.phone}</small></td>
              <td><b>{dateTime(c.created_at)}</b><small>Thời điểm tự động lưu</small></td>
              <td><mark>{c.customer_type}</mark></td>
              <td>{c.sales_channel}</td>
              <td>{Number(c.contact_count) > 1 ? <mark className="customer-return">Quay lại {Number(c.contact_count) - 1} lần</mark> : <mark className="customer-new">Khách mới</mark>}<small>Tổng {c.contact_count} lần</small></td>
              <td>{c.quote_count}</td>
              <td>{c.signed_count} đã ký</td>
              <td><b>{money(Number(c.signed_revenue))}</b></td>
              <td>{c.owner}</td>
              <td>{dateTime(c.last_contact_at)}</td>
            </tr>)}</tbody>
          </table>
          {!customers.length && <p className="empty">Chưa có data khách hàng. Khi tạo đơn hàng đầu tiên, khách sẽ tự động xuất hiện tại đây.</p>}
        </div>
      </section>
    </>
  );
}

function ChannelView({ month, channels, loading, onMonthChange }: {
  month: string;
  channels: ChannelPerformance[];
  loading: boolean;
  onMonthChange: (month: string) => void;
}) {
  const activeChannels = channels.filter((channel) => Number(channel.quote_count) > 0 || Number(channel.revenue) > 0);
  const totalRevenue = channels.reduce((sum, channel) => sum + Number(channel.revenue), 0);
  const totalQuotes = channels.reduce((sum, channel) => sum + Number(channel.quote_count), 0);
  const totalSigned = channels.reduce((sum, channel) => sum + Number(channel.signed_count), 0);
  const topChannel = activeChannels.reduce<ChannelPerformance | null>((best, channel) => {
    if (!best) return channel;
    if (Number(channel.revenue) !== Number(best.revenue)) return Number(channel.revenue) > Number(best.revenue) ? channel : best;
    return Number(channel.quote_count) > Number(best.quote_count) ? channel : best;
  }, null);
  const maxRevenue = Math.max(1, ...activeChannels.map((channel) => Number(channel.revenue)));
  const monthLabel = new Date(month + "-01T00:00:00").toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  return (
    <>
      <section className="channel-summary">
        <article><span>DOANH SỐ {monthLabel.toUpperCase()}</span><b>{short(totalRevenue)}</b><small>Chỉ tính hợp đồng đã ký trong tháng</small></article>
        <article><span>ĐƠN / BÁO GIÁ MỚI</span><b>{totalQuotes}</b><small>Phân loại theo kênh khách đến</small></article>
        <article><span>HỢP ĐỒNG ĐÃ KÝ</span><b>{totalSigned}</b><small>Được dùng để tính doanh số thực tế</small></article>
        <article><span>KÊNH HIỆU QUẢ NHẤT</span><b>{topChannel?.sales_channel || "Chưa có"}</b><small>{topChannel ? money(Number(topChannel.revenue)) : "Chưa phát sinh dữ liệu"}</small></article>
      </section>

      <section className="channel-layout">
        <div className="panel channel-ranking-panel">
          <div className="panel-title">
            <div><h3>Xếp hạng kênh bán hàng</h3><span>So sánh doanh số hợp đồng đã ký trong {monthLabel}</span></div>
            <label className="month-filter">Chọn tháng<input type="month" value={month} onChange={(event) => { if (event.target.value) onMonthChange(event.target.value); }} /></label>
          </div>
          <div className="channel-ranking">
            {loading ? <p className="empty">Đang tổng hợp dữ liệu...</p> : activeChannels.length ? activeChannels.map((channel, index) => (
              <div key={channel.sales_channel}>
                <i>{index + 1}</i>
                <span><b>{channel.sales_channel}</b><small>{channel.quote_count} đơn/báo giá · {channel.signed_count} hợp đồng đã ký</small></span>
                <u><em style={{ width: Math.max(3, Number(channel.revenue) / maxRevenue * 100) + "%" }} /></u>
                <strong>{money(Number(channel.revenue))}</strong>
              </div>
            )) : <p className="empty">Tháng này chưa có đơn hàng hoặc doanh số theo kênh.</p>}
          </div>
        </div>
      </section>

      <section className="panel page-panel channel-table-panel">
        <div className="panel-title"><div><h3>Tổng kết theo từng kênh</h3><span>Doanh số = tổng giá trị hợp đồng Đã ký có ngày ký trong tháng đã chọn</span></div></div>
        <div className="data-table">
          <table>
            <thead><tr><th>KÊNH BÁN HÀNG</th><th>KHÁCH HÀNG</th><th>ĐƠN / BÁO GIÁ</th><th>GIÁ TRỊ DỰ KIẾN</th><th>HỢP ĐỒNG ĐÃ KÝ</th><th>DOANH SỐ THỰC TẾ</th><th>TỶ TRỌNG</th></tr></thead>
            <tbody>{channels.map((channel) => {
              const share = totalRevenue > 0 ? Number(channel.revenue) / totalRevenue * 100 : 0;
              return <tr key={channel.sales_channel} className={Number(channel.revenue) > 0 ? "channel-has-revenue" : ""}>
                <td><b>{channel.sales_channel}</b></td>
                <td>{channel.customer_count}</td>
                <td>{channel.quote_count}</td>
                <td>{money(Number(channel.expected_value))}</td>
                <td>{channel.signed_count}</td>
                <td><b>{money(Number(channel.revenue))}</b></td>
                <td><mark>{share.toFixed(1).replace(".0", "")}%</mark></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function ContractsView({ contracts, salesSummary, director, onAdd, onEdit }: {
  contracts: Contract[];
  salesSummary: SalesSummary[];
  director: boolean;
  onAdd: () => void;
  onEdit: (contract: Contract) => void;
}) {
  const signedTotal = contracts.filter((c) => c.status === "Đã ký").reduce((sum, c) => sum + Number(c.contract_value), 0);
  return (
    <>
      <section className="contract-summary">
        <article><span>DOANH SỐ ĐÃ GHI NHẬN</span><b>{short(signedTotal)}</b><small>Chỉ tính hợp đồng trạng thái Đã ký</small></article>
        <article><span>CHỜ GIÁM ĐỐC DUYỆT</span><b>{contracts.filter((c) => c.status === "Chờ duyệt").length}</b><small>Hợp đồng chưa được cộng doanh số</small></article>
        <article><span>HỢP ĐỒNG ĐÃ KÝ</span><b>{contracts.filter((c) => c.status === "Đã ký").length}</b><small>Đã phân bổ cho Sales phụ trách</small></article>
      </section>
      <section className="sales-revenue-grid">
        {salesSummary.map((sale, index) => <article key={sale.id}><i>{index + 1}</i><span><small>DOANH SỐ SALES</small><b>{sale.full_name}</b><strong>{money(Number(sale.revenue))}</strong><em>{sale.signed_count} hợp đồng đã ký</em></span></article>)}
        {!salesSummary.length && <div className="panel empty">Chưa có Sales hoặc hợp đồng đã ký.</div>}
      </section>
      <section className="panel page-panel contract-panel">
        <div className="panel-title"><div><h3>Thư mục hợp đồng</h3><span>Doanh số tự động cộng cho người được phân công trên đơn hàng</span></div><button onClick={onAdd}>＋ Thêm hợp đồng</button></div>
        <div className="data-table"><table>
          <thead><tr><th>SỐ HỢP ĐỒNG</th><th>KHÁCH HÀNG</th><th>ĐƠN HÀNG</th><th>SALE ĐƯỢC TÍNH</th><th>GIÁ TRỊ</th><th>NGÀY KÝ</th><th>TRẠNG THÁI</th><th></th></tr></thead>
          <tbody>{contracts.map((c) => <tr key={c.id}><td><b>{c.contract_no}</b><small>{c.title}</small></td><td>{c.customer_name}<small>{c.customer_phone}</small></td><td>{c.project_name}</td><td><b>{c.salesperson}</b></td><td><b>{money(Number(c.contract_value))}</b></td><td>{c.signed_date ? new Date(c.signed_date).toLocaleDateString("vi-VN") : "—"}</td><td><mark className={c.status === "Đã ký" ? "contract-signed" : c.status === "Hủy" ? "contract-cancel" : "contract-pending"}>{c.status}</mark></td><td>{director && <button onClick={() => onEdit(c)}>Duyệt / Sửa</button>}</td></tr>)}</tbody>
        </table>{!contracts.length && <p className="empty">Chưa có hợp đồng. Bấm “Thêm hợp đồng” để bắt đầu.</p>}</div>
      </section>
    </>
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

function Modal({ kind, editing, editingProduct, editingContract, users, products, projects, director, busy, error, onClose, onSubmit }: {
  kind: string;
  editing: Project | null;
  editingProduct: InventoryProduct | null;
  editingContract: Contract | null;
  users: any[];
  products: InventoryProduct[];
  projects: Project[];
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
    contract: editingContract ? "Duyệt / cập nhật hợp đồng" : "Thêm hợp đồng",
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
              <div className="order-price-note"><b>Giá tự động theo Kho hàng</b><span>Đơn giá được chốt theo ngày lập đơn</span></div>
              <CustomerFields editing={editing} checkReturn={!editing} />
              <OrderItemsFields editing={editing} products={products} />
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
          ) : kind === "contract" ? (
            <>
              {editingContract ? <div className="contract-edit-info wide"><b>{editingContract.project_name}</b><span>{editingContract.customer_name} · {editingContract.customer_phone}</span><small>Doanh số ghi cho: {editingContract.salesperson}</small></div> : <label className="wide">Đơn hàng liên kết<select name="projectId" required defaultValue=""><option value="" disabled>Chọn đơn hàng / báo giá</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} — {project.contractor} — {money(Number(project.value))} — Sale: {project.owner}</option>)}</select></label>}
              <label>Số hợp đồng<input name="contractNo" required defaultValue={editingContract?.contract_no || "HĐ-2026-"} /></label>
              <label>Giá trị hợp đồng<input name="contractValue" type="number" min="0" required defaultValue={Number(editingContract?.contract_value || 0)} /></label>
              <label className="wide">Tên / nội dung hợp đồng<input name="title" defaultValue={editingContract?.title} placeholder="VD: Cung cấp hải sản tháng 7" /></label>
              <label>Ngày ký<input name="signedDate" type="date" defaultValue={editingContract?.signed_date?.slice(0, 10)} /></label>
              {director ? <label>Trạng thái<select name="status" defaultValue={editingContract?.status || "Chờ duyệt"}><option>Chờ duyệt</option><option>Đã ký</option><option>Hủy</option></select></label> : <input type="hidden" name="status" value="Chờ duyệt" />}
              <label className="wide">Ghi chú<textarea name="notes" defaultValue={editingContract?.notes} /></label>
              {!director && <div className="form-hint wide">Sau khi lưu, hợp đồng ở trạng thái Chờ duyệt. Doanh số chỉ được cộng khi Giám đốc chuyển sang Đã ký.</div>}
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

type OrderItemDraft = {
  key: string;
  itemId?: number;
  productId: string;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: number;
  priceDate: string;
};

function OrderItemsFields({ editing, products }: { editing: Project | null; products: InventoryProduct[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [items, setItems] = useState<OrderItemDraft[]>(() => editing?.items?.length
    ? editing.items.map((item) => ({
        key: "saved-" + item.id,
        itemId: item.id,
        productId: String(item.product_id),
        productName: item.product_name,
        unit: item.unit,
        quantity: String(Number(item.quantity)),
        unitPrice: Number(item.unit_price),
        priceDate: item.price_date,
      }))
    : [{ key: "new-0", productId: "", productName: "", unit: "kg", quantity: "", unitPrice: 0, priceDate: today }]);

  const selectedIds = new Set(items.map((item) => item.productId).filter(Boolean));
  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * Number(item.unitPrice || 0), 0);

  function changeProduct(key: string, productId: string) {
    const product = products.find((candidate) => String(candidate.id) === productId);
    setItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const keepSnapshot = Boolean(item.itemId && item.productId === productId);
      return {
        ...item,
        itemId: keepSnapshot ? item.itemId : undefined,
        productId,
        productName: keepSnapshot ? item.productName : product?.name || "",
        unit: keepSnapshot ? item.unit : product?.unit || "kg",
        unitPrice: keepSnapshot ? item.unitPrice : Number(product?.sale_price || 0),
        priceDate: keepSnapshot ? item.priceDate : today,
      };
    }));
  }

  function changeQuantity(key: string, quantity: string) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, quantity } : item));
  }

  function addItem() {
    setItems((current) => [...current, {
      key: `new-${Date.now()}-${current.length}`,
      productId: "",
      productName: "",
      unit: "kg",
      quantity: "",
      unitPrice: 0,
      priceDate: today,
    }]);
  }

  function removeItem(key: string) {
    setItems((current) => current.length === 1 ? current : current.filter((item) => item.key !== key));
  }

  const payload = items.map((item) => ({
    itemId: item.itemId,
    productId: Number(item.productId),
    quantity: Number(item.quantity),
  }));

  return (
    <div className="order-items wide">
      <input type="hidden" name="itemsJson" value={JSON.stringify(payload)} />
      <div className="order-items-head">
        <span><b>Sản phẩm khách mua</b><small>Chọn nhiều loại, nhập số lượng; hệ thống lấy giá bán trong Kho hàng</small></span>
        <button type="button" onClick={addItem} disabled={!products.length}>＋ Thêm sản phẩm</button>
      </div>
      {!products.length && <div className="form-hint">Chưa có hàng hóa. Hãy vào Kho hàng tạo sản phẩm và nhập giá bán trước.</div>}
      <div className="order-item-labels"><span>SẢN PHẨM</span><span>SỐ LƯỢNG</span><span>ĐƠN GIÁ</span><span>THÀNH TIỀN</span><span></span></div>
      {items.map((item) => {
        const lineTotal = (Number(item.quantity) || 0) * Number(item.unitPrice || 0);
        return <div className="order-item-row" key={item.key}>
          <select required value={item.productId} onChange={(event) => changeProduct(item.key, event.target.value)}>
            <option value="" disabled>Chọn loại hải sản</option>
            {products.map((product) => {
              const missingPrice = Number(product.sale_price) <= 0;
              const alreadySelected = selectedIds.has(String(product.id)) && item.productId !== String(product.id);
              return <option key={product.id} value={product.id} disabled={(missingPrice && item.productId !== String(product.id)) || alreadySelected}>{product.name} — {missingPrice ? "Cần cập nhật giá bán" : money(Number(product.sale_price)) + "/" + product.unit}</option>;
            })}
          </select>
          <label><input required type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => changeQuantity(item.key, event.target.value)} placeholder="0" /><small>{item.unit}</small></label>
          <span className={item.unitPrice > 0 ? "" : "missing-price"}><b>{money(item.unitPrice)}</b><small>Giá ngày {new Date(item.priceDate + "T00:00:00").toLocaleDateString("vi-VN")}</small></span>
          <strong>{money(lineTotal)}</strong>
          <button type="button" onClick={() => removeItem(item.key)} disabled={items.length === 1} aria-label="Xóa sản phẩm">×</button>
        </div>;
      })}
      <div className="order-total"><span><small>GIÁ TRỊ ĐƠN HÀNG DỰ KIẾN</small><b>Tự động cộng từ {items.filter((item) => item.productId).length} sản phẩm</b></span><strong>{money(total)}</strong></div>
    </div>
  );
}

function CustomerFields({ editing, checkReturn }: { editing: Project | null; checkReturn: boolean }) {
  const [name, setName] = useState(editing?.contractor || "");
  const [phone, setPhone] = useState(editing?.customer_phone || "");
  const [match, setMatch] = useState<any>(null);

  useEffect(() => {
    if (!checkReturn || name.trim().length < 2 || phone.replace(/\D/g, "").length < 8) {
      setMatch(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/customers/check?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`)
        .then((response) => response.json())
        .then((data) => setMatch(data.found ? data : null))
        .catch(() => setMatch(null));
    }, 450);
    return () => clearTimeout(timer);
  }, [name, phone, checkReturn]);

  return (
    <>
      <label>Tên khách hàng<input name="customerName" required value={name} onChange={(event) => setName(event.target.value)} placeholder="VD: Nguyễn Văn A" /></label>
      <label>Số điện thoại<input name="customerPhone" type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="VD: 0901234567" /></label>
      <label>Loại khách hàng<select name="customerType" defaultValue={editing?.customer_type || "Khách lẻ"}><option>Khách lẻ</option><option>Quán ăn / Nhà hàng</option><option>Đại lý</option><option>Nhóm mua chung</option><option>Doanh nghiệp</option><option>Khác</option></select></label>
      <label>Kênh bán hàng<select name="salesChannel" defaultValue={editing?.sales_channel || "Trực tiếp"}><option>Trực tiếp</option><option>Facebook</option><option>Zalo</option><option>TikTok</option><option>Khách giới thiệu</option><option>Khách cũ quay lại</option><option>Điện thoại</option><option>Khác</option></select></label>
      {match && <div className="customer-match wide"><b>Khách hàng cũ đã được nhận diện</b><span>{match.customer.name} · {match.customer.phone}</span><strong>Đang quay lại lần {match.nextReturnNumber}</strong><small>Lần gần nhất: {new Date(match.customer.last_contact_at).toLocaleDateString("vi-VN")} · Sale phụ trách: {match.customer.owner}</small></div>}
    </>
  );
}
