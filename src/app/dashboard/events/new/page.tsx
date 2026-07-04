import { EventForm } from "@/components/dashboard/event-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {formatMeta ? `New ${formatMeta.label} event` : "New event"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          {formatMeta
            ? formatMeta.description
            : "Set up a draft tournament. You can change the format anytime while editing."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>
            {format
              ? `Starting with ${getEventFormatLabel(format)}. You can edit this anytime while the event is in draft.`
              : "You can edit this anytime while the event is in draft."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EventForm defaultFormat={format} />
        </CardContent>
      </Card>
    </div>
  );
}
