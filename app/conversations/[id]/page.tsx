"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/liff-provider";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Message, Conversation } from "@/lib/types";
import { ArrowLeft, Send, Loader2, Shield } from "lucide-react";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function formatDateThai(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export default function ChatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showSafetyTips, setShowSafetyTips] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if user has seen safety tips
  useEffect(() => {
    const seen = localStorage.getItem("pawrent_safety_tips_seen");
    if (!seen) {
      setShowSafetyTips(true);
    }
  }, []);

  const dismissSafetyTips = () => {
    localStorage.setItem("pawrent_safety_tips_seen", "true");
    setShowSafetyTips(false);
  };

  const fetchMessages = useCallback(async () => {
    if (!user || !conversationId) return;
    try {
      const data = await apiFetch(`/api/conversations/${conversationId}/messages?limit=50`);
      // API returns newest first, reverse for chat display
      setMessages((data.data || []).reverse());
    } catch {
      // Silent fail
    }
  }, [user, conversationId]);

  const fetchConversation = useCallback(async () => {
    if (!user || !conversationId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/conversations?limit=50`);
      const conv = (data.data || []).find((c: Conversation) => c.id === conversationId);
      setConversation(conv || null);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [user, conversationId]);

  useEffect(() => {
    fetchConversation();
    fetchMessages();
  }, [fetchConversation, fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      setNewMessage("");
      await fetchMessages();
    } catch {
      alert("ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = conversation?.owner_id === user?.id;
  const otherPartyLabel = isOwner ? "ผู้พบสัตว์เลี้ยง" : "เจ้าของสัตว์เลี้ยง";

  return (
    <div className="min-h-screen bg-surface-alt flex flex-col">
      {/* Safety tips modal */}
      {showSafetyTips && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-success">
              <Shield className="w-6 h-6" />
              <h3 className="text-lg font-bold">ปลอดภัยไว้ก่อน</h3>
            </div>
            <ul className="space-y-2 text-sm text-text-main">
              <li className="flex items-start gap-2">
                <span className="text-danger font-bold mt-0.5">x</span>
                <span>อย่าโอนเงินก่อนพบตัวสัตว์เลี้ยง</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-danger font-bold mt-0.5">x</span>
                <span>อย่าให้ที่อยู่บ้าน — นัดพบที่สาธารณะ</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-success font-bold mt-0.5">o</span>
                <span>ใช้ระบบยืนยันตัวตนเพื่อพิสูจน์ความเป็นเจ้าของ</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning font-bold mt-0.5">!</span>
                <span>แจ้งพฤติกรรมน่าสงสัยด้วยปุ่ม รายงาน</span>
              </li>
            </ul>
            <Button
              onClick={dismissSafetyTips}
              className="w-full bg-success hover:bg-success text-white"
            >
              เข้าใจแล้ว
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ArrowLeft className="w-5 h-5 text-text-main" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-text-main truncate">{otherPartyLabel}</h1>
            <p className="text-xs text-text-muted">
              {conversation?.status === "open" ? "กำลังสนทนา" : "ปิดการสนทนา"}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted">เริ่มต้นสนทนาเพื่อประสานงานเรื่องสัตว์เลี้ยง</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          const showDate =
            i === 0 ||
            formatDateThai(msg.created_at) !== formatDateThai(messages[i - 1].created_at);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center my-3">
                  <span className="text-xs text-text-muted bg-surface-alt px-3 py-1 rounded-full">
                    {formatDateThai(msg.created_at)}
                  </span>
                </div>
              )}
              <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5",
                    isMe
                      ? "bg-primary text-white rounded-br-md"
                      : "bg-surface border border-border text-text-main rounded-bl-md"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      isMe ? "text-white/70 text-right" : "text-text-muted"
                    )}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {conversation?.status === "open" && (
        <div className="sticky bottom-0 bg-surface border-t border-border p-3 safe-area-bottom">
          <div className="max-w-md mx-auto flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์ข้อความ..."
              className="flex-1 px-4 py-2.5 border border-border rounded-2xl bg-background text-text-main resize-none max-h-24 text-sm"
              rows={1}
              maxLength={2000}
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="h-10 w-10 rounded-full bg-primary p-0 flex-shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
