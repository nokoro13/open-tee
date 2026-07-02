"use client";

import { UserButton } from "@clerk/nextjs";
import { CalendarPlus, Flag, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Events", icon: LayoutDashboard },
  { href: "/dashboard/events/new", label: "New event", icon: CalendarPlus },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:h-16 sm:max-w-5xl sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Flag className="size-4" />
            </div>
            <span className="font-heading text-base font-semibold tracking-tight sm:text-lg">
              OpenTee
            </span>
          </Link>

          <div className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <ButtonLink
                key={item.href}
                variant={pathname === item.href ? "secondary" : "ghost"}
                size="sm"
                href={item.href}
              >
                <item.icon />
                {item.label}
              </ButtonLink>
            ))}
          </div>

          <UserButton />
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md sm:hidden">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
