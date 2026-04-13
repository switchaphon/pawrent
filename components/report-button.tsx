"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function ReportButton() {
  return (
    <Link
      href="/post/lost"
      className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-destructive text-white font-semibold shadow-xl hover:scale-105 transition-transform active:scale-95"
    >
      <AlertTriangle className="w-5 h-5" />
      <span>แจ้งสัตว์เลี้ยงหาย</span>
    </Link>
  );
}
