import { notFound } from "next/navigation";

import { getEventById } from "@/actions/events";
import { buildCsv } from "@/lib/csv";
import { getRegistrationsForExport } from "@/lib/pairings";
import { requireOrganization } from "@/lib/auth";

type ExportRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: ExportRouteProps) {
  const { id } = await params;
  const org = await requireOrganization();
  const event = await getEventById(id);

  if (!event || event.orgId !== org.id) {
    notFound();
  }

  const registrations = await getRegistrationsForExport(id, org.id);

  if (!registrations) {
    notFound();
  }

  const rows = registrations.map((reg) => [
    reg.name,
    reg.email,
    reg.handicap ?? "",
    reg.paymentStatus,
    reg.pairingGroup?.label ?? "",
    reg.pairingGroup?.teeTime ?? "",
    reg.createdAt.toISOString(),
  ]);

  const csv = buildCsv(
    [
      "Name",
      "Email",
      "Handicap",
      "Payment Status",
      "Group",
      "Tee Time",
      "Registered At",
    ],
    rows
  );

  const filename = `${event.slug}-registrations.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
