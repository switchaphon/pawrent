/**
 * PosterButtons — Owner-only poster and share card download buttons.
 *
 * Visible only when `currentUserId === ownerId`.
 * Downloads A4 PDF poster or 1080x1350 JPEG share card.
 *
 * Implements PRP-04.1 Task 5
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAuthToken } from "@/lib/auth-token";
import { FileText, ImageIcon, Loader2 } from "lucide-react";

interface PosterButtonsProps {
  alertId: string;
  ownerId: string;
  currentUserId: string | null;
}

export function PosterButtons({ alertId, ownerId, currentUserId }: PosterButtonsProps) {
  const [posterLoading, setPosterLoading] = useState(false);
  const [shareCardLoading, setShareCardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Owner-only visibility
  if (!currentUserId || currentUserId !== ownerId) {
    return null;
  }

  async function downloadFile(
    endpoint: string,
    filename: string,
    setLoading: (v: boolean) => void
  ) {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        setError("ไม่สามารถสร้างได้ กรุณาลองใหม่");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("ไม่สามารถสร้างได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4 rounded-xl">
      <h3 className="font-bold text-text-main text-sm mb-3">สร้างสื่อประชาสัมพันธ์</h3>
      <div className="space-y-2">
        <Button
          onClick={() =>
            downloadFile(`/api/poster/${alertId}`, `poster-${alertId}.pdf`, setPosterLoading)
          }
          disabled={posterLoading}
          className="w-full h-11 rounded-xl bg-warning hover:bg-warning text-white"
        >
          {posterLoading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <FileText className="w-5 h-5 mr-2" />
          )}
          สร้างโปสเตอร์ A4
        </Button>
        <Button
          onClick={() =>
            downloadFile(
              `/api/share-card/${alertId}`,
              `share-card-${alertId}.jpg`,
              setShareCardLoading
            )
          }
          disabled={shareCardLoading}
          variant="outline"
          className="w-full h-11 rounded-xl"
        >
          {shareCardLoading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <ImageIcon className="w-5 h-5 mr-2" />
          )}
          ดาวน์โหลดรูปแชร์ 1080x1350
        </Button>
      </div>
      {error && <p className="text-xs text-danger text-center mt-2">{error}</p>}
    </Card>
  );
}
