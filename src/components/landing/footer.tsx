"use client";

import Link from "next/link";

import { OpenRoundMark } from "@/components/brand/openround-mark";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const footerLinks: Record<string, { label: string; href: string }[]> = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Pricing", href: "/#pricing" },
  ],
  Legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-[oklch(0.97_0.01_140)]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-6 lg:gap-12">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <OpenRoundMark />
              <span className="font-heading text-lg font-semibold tracking-tight">
                OpenRound
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Tournament software for clubs and organizers — registration,
              scoring, and payments in one place.
            </p>

            <form
              className="mt-7 max-w-sm"
              onSubmit={(e) => e.preventDefault()}
            >
              <Label htmlFor="footer-email" className="text-xs text-muted-foreground">
                Product updates
              </Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="footer-email"
                  type="email"
                  placeholder="you@club.com"
                  className="h-9 flex-1 bg-background"
                />
                <Button type="submit" className="shrink-0 sm:w-auto">
                  Subscribe
                </Button>
              </div>
            </form>
          </div>

          <div className="hidden gap-8 sm:grid sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4 lg:justify-items-start">
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {title}
                </h4>
                <ul className="mt-4 space-y-2.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Accordion className="lg:hidden">
            {Object.entries(footerLinks).map(([title, links], index) => (
              <AccordionItem key={title} value={`footer-${index}`}>
                <AccordionTrigger className="py-3 text-sm font-medium">
                  {title}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2.5 pb-2">
                    {links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-center text-sm text-muted-foreground sm:text-left">
            © {new Date().getFullYear()} OpenRound
          </p>
          <div className="flex flex-wrap justify-center gap-5 sm:gap-6">
            {["Twitter", "LinkedIn", "Instagram"].map((social) => (
              <Link
                key={social}
                href="#"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {social}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
