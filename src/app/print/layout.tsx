export const dynamic = "force-dynamic";

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="print-root min-h-dvh bg-muted/40 py-4 sm:py-8 print:bg-white print:py-0">
      {children}
    </div>
  );
}
