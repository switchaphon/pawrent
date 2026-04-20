"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/liff-provider";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { MessageCircle, Loader2, ArrowLeft } from "lucide-react";

function getRelativeTimeThai(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`;
  if (diffDay < 7) return `${diffDay} วันที่แล้ว`;
  return `${Math.floor(diffDay / 7)} สัปดาห์ที่แล้ว`;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  open: { label: "เปิด", className: "bg-success-bg text-success" },
  closed: { label: "ปิด", className: "bg-surface-alt text-text-muted" },
  resolved: { label: "สำเร็จ", className: "bg-info-bg text-info" },
};

export default function ConversationsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await apiFetch("/api/conversations?limit=50");
      setConversations(data.data || []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="min-h-screen bg-surface-alt pb-24">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href="/post" className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-text-main" />
          </Link>
          <MessageCircle className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-text-main">ข้อความ</h1>
        </div>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-primary/50" />
            </div>
            <h3 className="text-lg font-bold text-text-main mb-1">ยังไม่มีข้อความ</h3>
            <p className="text-sm text-text-muted">
              เมื่อคุณติดต่อผู้พบหรือเจ้าของสัตว์เลี้ยง ข้อความจะแสดงที่นี่
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const statusInfo = STATUS_LABELS[conv.status] ?? STATUS_LABELS.open;
              const isOwner = conv.owner_id === user?.id;

              return (
                <Link key={conv.id} href={`/conversations/${conv.id}`} className="block">
                  <div className="bg-surface rounded-xl border border-border p-4 active:scale-[0.98] transition-transform">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-text-main truncate">
                          {isOwner ? "ผู้พบสัตว์เลี้ยง" : "เจ้าของสัตว์เลี้ยง"}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {conv.alert_id ? "เกี่ยวกับประกาศหาย" : "เกี่ยวกับสัตว์ที่พบ"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            statusInfo.className
                          )}
                        >
                          {statusInfo.label}
                        </span>
                        <span className="text-xs text-text-muted">
                          {getRelativeTimeThai(conv.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
