"use client";

import { Flag, Menu } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Flag className="size-4" />
          </div>
          <span className="font-heading text-base font-semibold tracking-tight sm:text-lg">
            OpenRound
          </span>
        </Link>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {navLinks.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink
                  href={link.href}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ButtonLink
            variant="ghost"
            size="sm"
            href="/sign-in"
            className="hidden sm:inline-flex"
          >
            Sign in
          </ButtonLink>
          <ButtonLink
            size="sm"
            href="/sign-up"
            className="hidden sm:inline-flex"
          >
            Get started
          </ButtonLink>

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs px-0">
              <SheetHeader className="border-b border-border px-4 pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Flag className="size-3.5" />
                  </div>
                  OpenRound
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col px-2 py-2">
                {navLinks.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={
                      <Link
                        href={link.href}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
              </nav>

              <Separator />

              <div className="flex flex-col gap-2 px-4 py-4">
                <Link
                  href="/sign-in"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className={cn(buttonVariants(), "w-full")}
                >
                  Get started
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
