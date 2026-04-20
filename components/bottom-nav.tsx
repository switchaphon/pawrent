"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Newspaper, Megaphone, Bell, PawPrint, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "หน้าหลัก", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/post",
    label: "ฟีด",
    icon: Newspaper,
    match: (p: string) =>
      p === "/post" || p.startsWith("/post/") === false ? p === "/post" : false,
  },
  {
    href: "/post/lost",
    label: "แจ้ง",
    icon: Megaphone,
    match: (p: string) =>
      p.startsWith("/post/lost") || p.startsWith("/post/found") || p.startsWith("/post/new"),
  },
  {
    href: "/notifications",
    label: "แจ้งเตือน",
    icon: Bell,
    match: (p: string) => p.startsWith("/notifications"),
  },
  {
    href: "/pets",
    label: "สัตว์เลี้ยง",
    icon: PawPrint,
    match: (p: string) => p.startsWith("/pets"),
  },
  {
    href: "/profile",
    label: "โปรไฟล์",
    icon: User,
    match: (p: string) => p.startsWith("/profile"),
  },
] as const;

const HIDDEN_PATHS = ["/post/lost", "/post/found"];

export function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-t border-border safe-area-bottom"
    >
      <ul className="flex items-stretch justify-around h-16 max-w-md mx-auto px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 h-full w-full",
                  "text-[10px] font-bold transition-colors touch-target",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded-md",
                  isActive
                    ? "text-primary"
                    : "text-text-muted hover:text-text-main active:text-primary"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "scale-110")} aria-hidden />
                <span>{item.label}</span>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
