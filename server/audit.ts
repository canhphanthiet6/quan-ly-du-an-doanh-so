import type { Pool, PoolClient } from "pg";

type Queryable = Pick<Pool | PoolClient, "query">;

export type AuditActor = {
  id: number;
  fullName: string;
  role: string;
};

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export function requestAuditMetadata(request?: Request) {
  if (!request) return {};
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || request.headers.get("x-real-ip") || "",
    userAgent: request.headers.get("user-agent") || "",
  };
}

export async function writeAudit(db: Queryable, actor: AuditActor | null, entry: AuditEntry) {
  await db.query(
    `INSERT INTO audit_logs(
      actor_id,actor_name,actor_role,action,entity_type,entity_id,description,metadata,ip_address,user_agent
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
    [
      actor?.id || null,
      actor?.fullName || "Hệ thống",
      actor?.role || "system",
      entry.action,
      entry.entityType,
      entry.entityId === undefined || entry.entityId === null ? null : String(entry.entityId),
      entry.description,
      JSON.stringify(entry.metadata || {}),
      entry.ipAddress || "",
      (entry.userAgent || "").slice(0, 500),
    ],
  );
}
