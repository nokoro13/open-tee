import { EventCreationWizard } from "@/components/dashboard/event-creation-wizard";
import {
  getEventFormat,
  getEventFormatLabel,
  type EventFormat,
} from "@/lib/event-formats";

type NewEventPageProps = {
  searchParams: Promise<{ format?: string }>;
};

function resolveFormat(format?: string): EventFormat | undefined {
  if (!format) return undefined;
  return getEventFormat(format)?.value;
}

export default async function NewEventPage({ searchParams }: NewEventPageProps) {
  const { format: formatParam } = await searchParams;
  const format = resolveFormat(formatParam);
  const formatMeta = format ? getEventFormat(format) : undefined;

  return (
    <div className="mx-auto w-full min-w-0 space-y-5 pb-2 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
          {formatMeta ? `New ${formatMeta.label} event` : "New event"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {formatMeta
            ? formatMeta.description
            : "Set up your event step by step. You can change anything while it's in draft."}
        </p>
        {format && (
          <p className="mt-2 text-sm text-muted-foreground">
            Starting with {getEventFormatLabel(format)} — change it on the format step
            if needed.
          </p>
        )}
      </div>

      <EventCreationWizard defaultFormat={format} />
    </div>
  );
}
