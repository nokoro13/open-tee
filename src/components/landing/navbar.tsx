"use client";

import { useAuth } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Link from "next/link";

import { OpenRoundMark } from "@/components/brand/openround-mark";

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
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/65 md:border-b-0 md:bg-transparent md:pt-4 md:backdrop-blur-none md:supports-backdrop-filter:bg-transparent">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 md:h-14 md:rounded-2xl md:border md:border-border/60 md:bg-background/80 md:px-5 md:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] md:backdrop-blur-xl md:supports-backdrop-filter:bg-background/70 lg:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <OpenRoundMark />
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
          {isLoaded && isSignedIn ? (
            <ButtonLink
              size="sm"
              href="/dashboard"
              className="hidden sm:inline-flex"
            >
              Dashboard
            </ButtonLink>
          ) : (
            <>
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
            </>
          )}

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
                  <OpenRoundMark size="sm" />
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
                {isLoaded && isSignedIn ? (
                  <Link
                    href="/dashboard"
                    className={cn(buttonVariants(), "w-full")}
                  >
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/sign-in"
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "w-full"
                      )}
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/sign-up"
                      className={cn(buttonVariants(), "w-full")}
                    >
                      Get started
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
