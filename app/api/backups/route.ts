import { writeAudit, requestAuditMetadata } from "../../../server/audit";
import { createBusinessDataBackup } from "../../../server/backup";
import { canViewSecurity, getCurrentUser } from "../../../server/auth";
import { getPool, query } from "../../../server/db";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canViewSecurity(user)) return Response.json({ error: "Không có quyền xem bản sao lưu" }, { status: 403 });
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("download") || 0);
  if (id) {
    const result = await query<{ payload: unknown; backup_date: string; checksum: string }>(
      "SELECT payload,backup_date::text,checksum FROM system_backups WHERE id=$1",
      [id],
    );
    if (!result.rows[0]) return Response.json({ error: "Không tìm thấy bản sao lưu" }, { status: 404 });
    await writeAudit(getPool(), user, {
      action: "BACKUP_DOWNLOAD",
      entityType: "backup",
      entityId: id,
      description: `Tải bản sao lưu ngày ${result.rows[0].backup_date}`,
      ...requestAuditMetadata(request),
    });
    return new Response(JSON.stringify(result.rows[0].payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="hai-san-cang-backup-${result.rows[0].backup_date}-${id}.json"`,
        "x-backup-checksum": result.rows[0].checksum,
      },
    });
  }
  const result = await query(
    `SELECT b.id,b.backup_date::text,b.backup_type,b.status,b.size_bytes,b.checksum,b.created_at,
      COALESCE(u.full_name,'Hệ thống') creator
     FROM system_backups b LEFT JOIN users u ON u.id=b.created_by
     ORDER BY b.created_at DESC LIMIT 100`,
  );
  return Response.json({ backups: result.rows, retentionDays: 30 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canViewSecurity(user)) return Response.json({ error: "Không có quyền tạo bản sao lưu" }, { status: 403 });
  const backup = await createBusinessDataBackup(getPool(), "manual", user.id);
  await writeAudit(getPool(), user, {
    action: "BACKUP_CREATE",
    entityType: "backup",
    entityId: backup.id,
    description: "Tạo bản sao lưu thủ công",
    metadata: { checksum: backup.checksum, sizeBytes: backup.size_bytes },
    ...requestAuditMetadata(request),
  });
  return Response.json({ backup }, { status: 201 });
}
