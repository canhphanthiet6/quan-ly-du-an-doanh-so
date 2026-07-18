import { createHash } from "crypto";
import type { Pool } from "pg";

const BACKUP_TABLES = [
  "users",
  "projects",
  "customers",
  "project_items",
  "contracts",
  "inventory_products",
  "inventory_movements",
  "work_reports",
  "weekly_plans",
  "documents",
  "events",
  "audit_logs",
] as const;

export type BackupType = "automatic" | "manual";

export async function createBusinessDataBackup(pool: Pool, type: BackupType, createdBy: number | null) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    if (type === "automatic") {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('hai-san-cang-daily-backup'))");
      const existing = await client.query(
        "SELECT id,backup_date,backup_type,status,size_bytes,checksum,created_at FROM system_backups WHERE backup_type='automatic' AND backup_date=CURRENT_DATE AND jsonb_array_length(payload->'tables'->'users')>0 LIMIT 1",
      );
      if (existing.rows[0]) {
        await client.query("COMMIT");
        return existing.rows[0];
      }
      await client.query("DELETE FROM system_backups WHERE backup_type='automatic' AND backup_date=CURRENT_DATE");
    }

    const tables: Record<string, unknown[]> = {};
    for (const table of BACKUP_TABLES) {
      if (table === "users") {
        const result = await client.query(
          "SELECT id,username,full_name,role,active,must_change_password,password_changed_at,last_login_at,created_at,updated_at FROM users ORDER BY id",
        );
        tables[table] = result.rows;
      } else {
        const result = await client.query(`SELECT * FROM ${table} ORDER BY id`);
        tables[table] = result.rows;
      }
    }

    const payload = {
      format: "hai-san-cang-business-backup",
      version: 1,
      createdAt: new Date().toISOString(),
      tables,
    };
    const serialized = JSON.stringify(payload);
    const checksum = createHash("sha256").update(serialized).digest("hex");
    const result = await client.query(
      `INSERT INTO system_backups(backup_type,status,payload,size_bytes,checksum,created_by)
       VALUES($1,'completed',$2::jsonb,$3,$4,$5)
       RETURNING id,backup_date,backup_type,status,size_bytes,checksum,created_at`,
      [type, serialized, Buffer.byteLength(serialized), checksum, createdBy],
    );
    await client.query("DELETE FROM system_backups WHERE created_at < NOW() - INTERVAL '30 days'");
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
