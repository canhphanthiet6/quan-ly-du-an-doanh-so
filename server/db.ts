import { Pool, QueryResultRow } from "pg";

declare global { var __vietWaterPool: Pool | undefined; var __vietWaterReady: Promise<void> | undefined; }

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL chưa được cấu hình. Hãy thêm PostgreSQL vào Railway.");
  if (!global.__vietWaterPool) global.__vietWaterPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined });
  return global.__vietWaterPool;
}

export async function ensureSchema() {
  if (global.__vietWaterReady) return global.__vietWaterReady;
  global.__vietWaterReady = (async () => {
    const db = getPool();
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('director','admin','sales','accounting','hr')), password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, must_change_password BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS sessions (id SERIAL PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, contractor TEXT NOT NULL DEFAULT '', product TEXT NOT NULL DEFAULT '', owner_id INTEGER REFERENCES users(id), probability INTEGER NOT NULL DEFAULT 30, status TEXT NOT NULL DEFAULT 'Khách mới / Quan tâm', value BIGINT NOT NULL DEFAULT 0, deadline DATE, next_action TEXT NOT NULL DEFAULT '', created_by INTEGER REFERENCES users(id), approved_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, normalized_name TEXT NOT NULL, normalized_phone TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, customer_type TEXT NOT NULL DEFAULT 'Khách lẻ', sales_channel TEXT NOT NULL DEFAULT 'Trực tiếp', contact_count INTEGER NOT NULL DEFAULT 1, first_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), assigned_to INTEGER REFERENCES users(id), created_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(normalized_name,normalized_phone))`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'Khách lẻ'`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS sales_channel TEXT NOT NULL DEFAULT 'Trực tiếp'`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id)`,
      `ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'Khách mới / Quan tâm'`,
      `UPDATE projects SET status='Khách mới / Quan tâm' WHERE status IN ('Đang thiết kế','Báo giá dự toán','Đang thiết kế / Báo giá dự toán')`,
      `CREATE TABLE IF NOT EXISTS work_reports (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), report_date DATE NOT NULL DEFAULT CURRENT_DATE, customer TEXT NOT NULL DEFAULT '', project_name TEXT NOT NULL DEFAULT '', content TEXT NOT NULL, result TEXT NOT NULL DEFAULT '', next_action TEXT NOT NULL DEFAULT '', due_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS weekly_plans (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), week_start DATE NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', due_date DATE, status TEXT NOT NULL DEFAULT 'Chưa thực hiện', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS documents (id SERIAL PRIMARY KEY, direction TEXT NOT NULL CHECK (direction IN ('Đến','Đi')), document_no TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL, partner TEXT NOT NULL DEFAULT '', issue_date DATE NOT NULL DEFAULT CURRENT_DATE, owner_id INTEGER REFERENCES users(id), due_date DATE, status TEXT NOT NULL DEFAULT 'Đang xử lý', notes TEXT NOT NULL DEFAULT '', created_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS events (id SERIAL PRIMARY KEY, event_type TEXT NOT NULL CHECK (event_type IN ('Họp','Lịch hẹn','Công tác')), title TEXT NOT NULL, start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ, location TEXT NOT NULL DEFAULT '', participants TEXT NOT NULL DEFAULT '', owner_id INTEGER REFERENCES users(id), notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Sắp diễn ra', created_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS inventory_products (id SERIAL PRIMARY KEY, sku TEXT UNIQUE NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT 'kg', cost_price NUMERIC(14,2) NOT NULL DEFAULT 0, sale_price NUMERIC(14,2) NOT NULL DEFAULT 0, stock_qty NUMERIC(14,3) NOT NULL DEFAULT 0, min_stock NUMERIC(14,3) NOT NULL DEFAULT 0, peak_months TEXT NOT NULL DEFAULT '', season_note TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE, created_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS project_items (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES inventory_products(id), product_name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT 'kg', quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0), unit_price NUMERIC(14,2) NOT NULL DEFAULT 0, price_date DATE NOT NULL DEFAULT CURRENT_DATE, line_total NUMERIC(16,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS inventory_movements (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES inventory_products(id), movement_type TEXT NOT NULL CHECK (movement_type IN ('Nhập','Xuất','Điều chỉnh tăng','Điều chỉnh giảm')), quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0), unit_price NUMERIC(14,2) NOT NULL DEFAULT 0, movement_date DATE NOT NULL DEFAULT CURRENT_DATE, note TEXT NOT NULL DEFAULT '', created_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE TABLE IF NOT EXISTS contracts (id SERIAL PRIMARY KEY, contract_no TEXT UNIQUE NOT NULL, project_id INTEGER NOT NULL REFERENCES projects(id), customer_id INTEGER REFERENCES customers(id), title TEXT NOT NULL DEFAULT '', contract_value BIGINT NOT NULL DEFAULT 0, signed_date DATE, status TEXT NOT NULL DEFAULT 'Chờ duyệt' CHECK (status IN ('Chờ duyệt','Đã ký','Hủy')), salesperson_id INTEGER REFERENCES users(id), notes TEXT NOT NULL DEFAULT '', created_by INTEGER REFERENCES users(id), approved_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
      `CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash)`,
      `CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects(owner_id)`,
      `CREATE INDEX IF NOT EXISTS reports_user_idx ON work_reports(user_id)`,
      `CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON inventory_movements(product_id)`,
      `CREATE INDEX IF NOT EXISTS project_items_project_idx ON project_items(project_id)`,
      `CREATE INDEX IF NOT EXISTS project_items_product_idx ON project_items(product_id)`,
      `CREATE INDEX IF NOT EXISTS inventory_movements_date_idx ON inventory_movements(movement_date)`,
      `CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(normalized_phone)`,
      `CREATE INDEX IF NOT EXISTS projects_customer_idx ON projects(customer_id)`,
      `CREATE INDEX IF NOT EXISTS contracts_salesperson_idx ON contracts(salesperson_id)`,
      `CREATE INDEX IF NOT EXISTS contracts_project_idx ON contracts(project_id)`,
    ];
    for (const sql of statements) await db.query(sql);
  })().catch(error => { global.__vietWaterReady = undefined; throw error; });
  return global.__vietWaterReady;
}

export async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []) {
  await ensureSchema();
  return getPool().query<T>(text, values);
}
