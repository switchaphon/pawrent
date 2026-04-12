"use client";

import { ReactNode } from "react";
import { useAuth } from "@/components/liff-provider";
import { BottomNav } from "@/components/bottom-nav";

export function NavigationShell({ children }: { children: ReactNode }) {
  const { isInLiff } = useAuth();

  return (
    <div className={isInLiff ? "" : "pb-16"}>
      {children}
      {!isInLiff && <BottomNav />}
    </div>
  );
}
