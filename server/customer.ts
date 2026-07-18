import type { PoolClient } from "pg";

export function normalizeCustomerName(value: unknown) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
}

export function normalizeCustomerPhone(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export async function saveCustomer(client: PoolClient, data: Record<string, unknown>, userId: number, ownerId: number, incrementContact: boolean) {
  const name = String(data.customerName || data.contractor || "").trim();
  const phone = String(data.customerPhone || "").trim();
  const address = String(data.customerArea || "").trim();
  const normalizedName = normalizeCustomerName(name);
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!name || !normalizedName || normalizedPhone.length < 8) throw new Error("Cần nhập tên khách hàng và số điện thoại hợp lệ");
  const found = await client.query<{ id: number; contact_count: number }>("SELECT id,contact_count FROM customers WHERE normalized_name=$1 AND normalized_phone=$2 FOR UPDATE", [normalizedName, normalizedPhone]);
  if (found.rows[0]) {
    const current = found.rows[0];
    const result = await client.query<{ id: number; contact_count: number }>(`UPDATE customers SET name=$1,phone=$2,customer_type=$3,sales_channel=$4,address=$5,assigned_to=$6,last_contact_at=CASE WHEN $7 THEN NOW() ELSE last_contact_at END,contact_count=contact_count+CASE WHEN $7 THEN 1 ELSE 0 END,updated_at=NOW() WHERE id=$8 RETURNING id,contact_count`, [name, phone, data.customerType || "Khách lẻ", data.salesChannel || "Trực tiếp", address, ownerId, incrementContact, current.id]);
    return { id: result.rows[0].id, isExisting: true, contactCount: result.rows[0].contact_count, returnNumber: incrementContact ? current.contact_count : Math.max(0, current.contact_count - 1) };
  }
  const created = await client.query<{ id: number; contact_count: number }>(`INSERT INTO customers(normalized_name,normalized_phone,name,phone,customer_type,sales_channel,address,assigned_to,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,contact_count`, [normalizedName, normalizedPhone, name, phone, data.customerType || "Khách lẻ", data.salesChannel || "Trực tiếp", address, ownerId, userId]);
  return { id: created.rows[0].id, isExisting: false, contactCount: 1, returnNumber: 0 };
}
