import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Flag } from "lucide-react";

import { verifyRegistrationSession } from "@/actions/registrations";
import { getPublishedEventBySlug } from "@/lib/events";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SuccessPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string; free?: string }>;
};

export default async function RegistrationSuccessPage({
  params,
  searchParams,
}: SuccessPageProps) {
  const { slug } = await params;
  const { session_id, free } = await searchParams;
  const event = await getPublishedEventBySlug(slug);

  if (!event) {
    notFound();
  }

  let playerName: string | undefined;

  if (session_id) {
    const registration = await verifyRegistrationSession(session_id);
    if (registration?.event.slug === slug) {
      playerName = registration.name;
    }
  }

  if (free === "1" && !playerName) {
    playerName = "Golfer";
  }

  return (
    <div className="min-h-full bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flag className="size-4" />
            </div>
            <span className="font-heading text-base font-semibold">OpenRound</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-7" />
            </div>
            <CardTitle className="text-xl">You&apos;re registered!</CardTitle>
            <CardDescription>
              {playerName ? (
                <>
                  See you on the course, <strong>{playerName}</strong>.
                </>
              ) : (
                <>Your registration for {event.name} is confirmed.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <p>
              A confirmation email has been sent with event details. Check your
              inbox (and spam folder).
            </p>
            <ButtonLink variant="outline" href={`/e/${slug}`} className="w-full">
              Back to event page
            </ButtonLink>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
