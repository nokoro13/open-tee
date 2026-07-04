import {
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  ClipboardList,
  CreditCard,
  Globe,
  Mail,
  MapPin,
  Smartphone,
  Trophy,
  Users,
} from "lucide-react";

import { FeatureList } from "@/components/landing/feature-list";
import { Footer } from "@/components/landing/footer";
import { ImagePlaceholder } from "@/components/landing/image-placeholder";
import { Navbar } from "@/components/landing/navbar";
import { SectionHeader } from "@/components/landing/section-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const features = [
  {
    icon: Calendar,
    title: "Event scheduling",
    description:
      "Create multi-day tournaments with tee times, flights, and shotgun starts in minutes.",
  },
  {
    icon: Users,
    title: "Registration & pairing",
    description:
      "Online sign-ups, handicap tracking, and automatic pairing based on your format rules.",
  },
  {
    icon: Trophy,
    title: "Live scoring",
    description:
      "Real-time leaderboards, hole-by-hole scoring, and instant results for players and spectators.",
  },
  {
    icon: CreditCard,
    title: "Payments & sponsorships",
    description:
      "Collect entry fees, manage sponsor packages, and track revenue from a single dashboard.",
  },
  {
    icon: Mail,
    title: "Communications",
    description:
      "Automated email reminders, SMS updates, and branded announcements to keep everyone informed.",
  },
  {
    icon: BarChart3,
    title: "Analytics & reports",
    description:
      "Attendance trends, revenue breakdowns, and post-event reports you can share with stakeholders.",
  },
];

const steps = [
  {
    step: "01",
    title: "Set up your event",
    description:
      "Define your format, dates, course details, and registration options in a guided setup flow.",
  },
  {
    step: "02",
    title: "Open registration",
    description:
      "Share your branded event page. Players sign up, pay, and receive confirmations automatically.",
  },
  {
    step: "03",
    title: "Run tournament day",
    description:
      "Manage pairings, track scores live, and publish results the moment the final putt drops.",
  },
];

const testimonials = [
  {
    quote:
      "We went from spreadsheets and phone calls to a fully managed charity outing. OpenRound saved us dozens of hours.",
    name: "Sarah Mitchell",
    initials: "SM",
    role: "Tournament Director, Pine Valley Charity Classic",
  },
  {
    quote:
      "Live scoring was a game-changer. Our members loved following the leaderboard on their phones all day.",
    name: "James Chen",
    initials: "JC",
    role: "Head Pro, Riverside Golf Club",
  },
  {
    quote:
      "The registration flow alone paid for itself. We sold out in 48 hours with zero manual follow-up.",
    name: "David Torres",
    initials: "DT",
    role: "Events Manager, Metro Amateur Series",
  },
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$49",
    period: "per event",
    description: "Perfect for single-day outings and small club events.",
    features: [
      "Up to 72 players",
      "Online registration",
      "Basic leaderboard",
      "Email notifications",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$149",
    period: "per event",
    description: "For serious tournaments that need the full toolkit.",
    features: [
      "Unlimited players",
      "Mobile-optimized live scoring",
      "Payment processing",
      "Sponsor management",
      "Custom branding",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "annual",
    description: "For clubs, associations, and multi-event operators.",
    features: [
      "Unlimited events",
      "Dedicated account manager",
      "API access",
      "White-label options",
      "Custom integrations",
      "SLA & onboarding",
    ],
    highlighted: false,
  },
];

const faqs = [
  {
    question: "What tournament formats does OpenRound support?",
    answer:
      "OpenRound supports stroke play, Stableford, scramble, best ball, match play, and custom formats. You can configure flights, handicaps, and tiebreaker rules for each event.",
  },
  {
    question: "Can players register and pay online?",
    answer:
      "Yes. Players complete registration through your branded event page and pay securely via credit card. You can also offer comp entries and group registrations.",
  },
  {
    question: "Do I need special hardware for live scoring?",
    answer:
      "No. Volunteers and players enter scores from any smartphone browser — no app install needed. Course staff can also use a tablet or desktop scoring station.",
  },
  {
    question: "Can I use OpenRound for charity and corporate events?",
    answer:
      "Absolutely. Many customers run charity outings, corporate scrambles, and association championships on OpenRound. Sponsor packages and donation tracking are built in.",
  },
  {
    question: "Do I need to download an app?",
    answer:
      "No. OpenRound is fully web-based — open it in Safari, Chrome, or any mobile browser. There is nothing to install from an app store. The interface is built mobile-first because most players and directors use their phones on tournament day.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "You can explore the platform and build your first event for free. Payment is only required when you publish registration and go live.",
  },
];

const stats = [
  { value: "2,500+", label: "Events hosted" },
  { value: "180K+", label: "Players registered" },
  { value: "98%", label: "Customer satisfaction" },
  { value: "40+", label: "States represented" },
];

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,var(--hero-glow),transparent)]" />
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:pb-28 lg:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-4 sm:mb-6">
                Golf tournament management, simplified
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl lg:text-6xl">
                Host unforgettable tournaments without the{" "}
                <span className="text-primary">spreadsheet chaos</span>
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground text-balance sm:mt-6 sm:text-lg lg:text-xl">
                OpenRound gives clubs, pros, and event organizers everything they
                need to run registration, pairings, live scoring, and payments
                — a mobile-first web platform that works beautifully on any
                device, no download required.
              </p>
              <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:justify-center">
                <ButtonLink
                  size="lg"
                  href="/sign-up"
                  className="h-11 w-full px-6 sm:w-auto"
                >
                  Start free trial
                  <ArrowRight />
                </ButtonLink>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 w-full px-6 sm:w-auto"
                >
                  Watch demo
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground sm:text-sm">
                No credit card required · No app to install · Works on any phone
              </p>
            </div>

            <div className="relative mx-auto mt-10 max-w-5xl sm:mt-16">
              <div className="absolute -inset-2 rounded-2xl bg-primary/5 blur-2xl sm:-inset-4" />
              <ImagePlaceholder
                label="Dashboard preview"
                aspectRatio="wide"
                className="relative shadow-xl ring-1 ring-border/50 sm:shadow-2xl"
              />
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-y border-border bg-muted/30 py-10 sm:py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="mb-6 text-center text-xs font-medium text-muted-foreground sm:mb-8 sm:text-sm">
              Trusted by clubs and organizers across the country
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <ImagePlaceholder
                  key={i}
                  label={`Partner logo ${i + 1}`}
                  aspectRatio="video"
                  className="h-10 rounded-lg sm:h-12 [&_svg]:size-4 sm:[&_svg]:size-5"
                />
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 sm:py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader
              badge="Features"
              title="Everything you need to run a world-class event"
              description="From the first registration to the final trophy presentation, OpenRound handles the details so you can focus on the experience."
            />

            <div className="mt-10 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-border/60 transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="size-5" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Product showcase */}
        <section className="border-y border-border bg-muted/20 py-16 sm:py-20 lg:py-28">
          <div className="mx-auto max-w-6xl space-y-16 px-4 sm:space-y-24 sm:px-6 lg:space-y-28">
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div>
                <Badge variant="secondary" className="mb-4">
                  Live scoring
                </Badge>
                <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl">
                  Leaderboards that update in real time
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
                  Keep players, spectators, and sponsors engaged with live
                  standings accessible from any device. No more waiting at the
                  clubhouse for results.
                </p>
                <FeatureList
                  className="mt-6 sm:mt-8"
                  items={[
                    "Hole-by-hole score entry from mobile",
                    "Automatic handicap calculations",
                    "TV-ready display mode for clubhouses",
                    "Shareable public leaderboard links",
                  ]}
                />
              </div>
              <ImagePlaceholder
                label="Live scoring screenshot"
                aspectRatio="video"
                className="shadow-lg ring-1 ring-border/50 lg:shadow-xl"
              />
            </div>

            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <ImagePlaceholder
                label="Registration page screenshot"
                aspectRatio="video"
                className="shadow-lg ring-1 ring-border/50 lg:order-1 lg:shadow-xl"
              />
              <div>
                <Badge variant="secondary" className="mb-4">
                  Registration
                </Badge>
                <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl">
                  A registration experience players actually enjoy
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
                  Branded event pages, flexible pricing tiers, and seamless
                  checkout mean fewer drop-offs and more filled tee sheets.
                </p>
                <FeatureList
                  className="mt-6 sm:mt-8"
                  items={[
                    "Custom event branding and URLs",
                    "Early-bird and group pricing",
                    "Waitlist management",
                    "Automated confirmation emails",
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-16 sm:py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader
              badge="How it works"
              title="From setup to celebration in three steps"
              description="Whether it's your first outing or your fiftieth, OpenRound gets you live fast."
            />

            <div className="mt-10 grid gap-4 sm:mt-16 sm:gap-6 lg:grid-cols-3">
              {steps.map((item) => (
                <Card key={item.step} className="border-border/60">
                  <CardHeader>
                    <Badge
                      variant="outline"
                      className="mb-2 w-fit border-primary/30 bg-primary/5 font-mono text-primary"
                    >
                      Step {item.step}
                    </Badge>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            <Card className="mt-10 overflow-hidden border-border/60 p-0 sm:mt-16">
              <CardContent className="p-0">
                <ImagePlaceholder
                  label="Setup workflow screenshot"
                  aspectRatio="wide"
                  className="rounded-none border-0"
                />
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Mobile web */}
        <section className="border-y border-border bg-primary py-12 text-primary-foreground sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
              <div className="text-center lg:text-left">
                <Badge
                  variant="secondary"
                  className="mb-4 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
                >
                  <Smartphone className="size-3" />
                  Mobile-first web
                </Badge>
                <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl">
                  Built for phones — no app store required
                </h2>
                <p className="mt-3 text-sm leading-relaxed opacity-80 sm:mt-4 sm:text-base">
                  OpenRound runs entirely in the browser. Most users are on their
                  phones during tournament day, so every flow — registration,
                  scoring, pairings — is designed for mobile first.
                </p>
                <ul className="mt-6 space-y-2.5 text-left text-sm opacity-90 sm:mt-8">
                  {[
                    "Works in any mobile browser — nothing to download",
                    "Thumb-friendly UI for score entry on the course",
                    "Same experience on phone, tablet, and desktop",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 size-4 shrink-0"
                        strokeWidth={2.5}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  variant="secondary"
                  size="lg"
                  href="/sign-up"
                  className="mt-6 hidden h-11 sm:inline-flex"
                >
                  Start free trial
                  <ArrowRight />
                </ButtonLink>
              </div>

              <div className="flex items-end justify-center gap-3 sm:gap-4">
                <ImagePlaceholder
                  label="Mobile web screen"
                  aspectRatio="portrait"
                  className="w-[140px] border-primary-foreground/20 bg-primary-foreground/5 sm:w-[180px] lg:w-[200px] [&_span]:text-[10px] [&_span]:text-primary-foreground/50 sm:[&_span]:text-xs [&_svg]:size-6 [&_svg]:text-primary-foreground/40 sm:[&_svg]:size-8"
                />
                <ImagePlaceholder
                  label="Mobile web screen"
                  aspectRatio="portrait"
                  className="hidden w-[140px] border-primary-foreground/20 bg-primary-foreground/5 sm:block sm:w-[180px] lg:w-[200px] [&_span]:text-[10px] [&_span]:text-primary-foreground/50 sm:[&_span]:text-xs [&_svg]:size-6 [&_svg]:text-primary-foreground/40 sm:[&_svg]:size-8"
                />
              </div>

              <ButtonLink
                variant="secondary"
                size="lg"
                href="/sign-up"
                className="h-11 w-full sm:hidden"
              >
                Start free trial
                <ArrowRight />
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-16 sm:py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader
              badge="Testimonials"
              title="Loved by tournament directors everywhere"
            />

            <div className="mt-10 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <Card
                  key={testimonial.name}
                  className="border-border/60 transition-shadow hover:shadow-md"
                >
                  <CardContent className="pt-6">
                    <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <Separator className="my-5" />
                    <div className="flex items-center gap-3">
                      <Avatar size="lg">
                        <AvatarFallback className="bg-primary/10 font-medium text-primary">
                          {testimonial.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {testimonial.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          className="border-t border-border bg-muted/20 py-16 sm:py-20 lg:py-28"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeader
              badge="Pricing"
              title="Simple pricing for every event size"
              description="Pay per event or scale with an annual plan. No hidden fees."
            />

            <div className="mt-10 grid gap-4 sm:mt-16 sm:gap-6 lg:grid-cols-3 lg:items-start">
              {pricingPlans.map((plan) => (
                <Card
                  key={plan.name}
                  className={
                    plan.highlighted
                      ? "relative border-primary shadow-lg ring-1 ring-primary/20 lg:-mt-2 lg:mb-2"
                      : "border-border/60"
                  }
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge>Most popular</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="pt-2">
                      <span className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        {plan.price}
                      </span>
                      <span className="ml-1 text-sm text-muted-foreground">
                        / {plan.period}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Separator className="mb-4" />
                    <ul className="space-y-2.5">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm"
                        >
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant={plan.highlighted ? "default" : "outline"}
                      className="w-full"
                      size="lg"
                    >
                      {plan.name === "Enterprise"
                        ? "Contact sales"
                        : "Get started"}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {stats.map((stat) => (
                <Card
                  key={stat.label}
                  className="border-border/60 text-center shadow-none"
                >
                  <CardContent className="px-4 py-5 sm:px-6 sm:py-6">
                    <p className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl lg:text-4xl">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      {stat.label}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border py-16 sm:py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
              <SectionHeader
                badge="FAQ"
                title="Frequently asked questions"
                description="Have a question not listed here? Our team is happy to help you plan your next event."
                align="left"
              />

              <Card className="border-border/60">
                <CardContent className="pt-2">
                  <Accordion className="w-full">
                    {faqs.map((faq, index) => (
                      <AccordionItem key={faq.question} value={`item-${index}`}>
                        <AccordionTrigger className="text-left">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent>{faq.answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4 lg:hidden">
              <Badge variant="outline" className="w-fit gap-2 py-1.5">
                <Globe className="size-3.5" />
                openround.club/help
              </Badge>
              <Badge variant="outline" className="w-fit gap-2 py-1.5">
                <MapPin className="size-3.5" />
                US & Canada
              </Badge>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-border bg-muted/30 py-16 sm:py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Card className="overflow-hidden border-0 bg-primary text-primary-foreground shadow-xl">
              <CardContent className="relative px-6 py-12 text-center sm:px-10 sm:py-16 lg:px-16 lg:py-20">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent_50%)]" />
                <div className="relative">
                  <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-primary-foreground/10 sm:mb-6 sm:size-14">
                    <ClipboardList className="size-6 opacity-90 sm:size-7" />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl">
                    Ready to tee off your next tournament?
                  </h2>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed opacity-80 sm:mt-4 sm:text-base">
                    Join thousands of organizers who trust OpenRound to deliver
                    seamless events. Start building your tournament today.
                  </p>
                  <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:justify-center">
                    <ButtonLink
                      size="lg"
                      variant="secondary"
                      href="/sign-up"
                      className="h-11 w-full px-6 sm:w-auto"
                    >
                      Start free trial
                      <ArrowRight />
                    </ButtonLink>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-11 w-full border-primary-foreground/30 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
                    >
                      Talk to sales
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
