"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Bell, PawPrint, User, Cross } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Feed", icon: Home },
  { href: "/notifications", label: "Notify", icon: Bell },
  { href: "/hospital", label: "Hospital", icon: Cross },
  { href: "/pets", label: "Pets", icon: PawPrint },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4 py-2 transition-colors touch-target",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground active:text-primary"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
