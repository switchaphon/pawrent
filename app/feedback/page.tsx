"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/liff-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { uploadFeedbackImage } from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { feedbackSchema, imageFileSchema } from "@/lib/validations";
import { MessageSquare, X, ImagePlus, CheckCircle, ArrowLeft, Loader2 } from "lucide-react";

function FeedbackContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAnonymous = searchParams.get("anonymous") === "true";

  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackImage, setFeedbackImage] = useState<File | null>(null);
  const [feedbackImagePreview, setFeedbackImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Feedback requires authentication for RLS
  const userId = user?.id ?? null;

  const handleSubmit = async () => {
    const feedbackResult = feedbackSchema.safeParse({ message: feedbackText });
    if (!feedbackResult.success) {
      alert(feedbackResult.error.issues[0].message);
      return;
    }

    if (feedbackImage) {
      const fileResult = imageFileSchema.safeParse({
        size: feedbackImage.size,
        type: feedbackImage.type,
      });
      if (!fileResult.success) {
        alert(fileResult.error.issues[0].message);
        return;
      }
    }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;

      // Upload image if attached
      if (feedbackImage) {
        const { data: uploadedUrl, error: uploadError } = await uploadFeedbackImage(
          feedbackImage,
          userId
        );
        if (uploadError) {
          console.error("Failed to upload image:", uploadError);
        } else {
          imageUrl = uploadedUrl;
        }
      }

      // Submit feedback via API route
      try {
        await apiFetch("/api/feedback", {
          method: "POST",
          body: JSON.stringify({
            message: feedbackText,
            image_url: imageUrl,
          }),
        });
      } catch (apiError: unknown) {
        const msg = apiError instanceof Error ? apiError.message : "Unknown error";
        console.error("Feedback error:", apiError);
        alert(`Failed to submit feedback: ${msg}`);
        return;
      }
      setSuccess(true);
      setFeedbackText("");
      setFeedbackImage(null);
      setFeedbackImagePreview(null);
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (isAnonymous && !user) {
      router.push("/");
    } else {
      router.back();
    }
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-bg-start to-bg-end pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            aria-label="ย้อนกลับ"
            className="text-text-muted hover:text-text-main"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-extrabold text-text-main">ส่งความคิดเห็น</h1>
          {!user && (
            <span className="ml-auto text-[10px] font-bold text-text-muted bg-surface-alt px-2.5 py-1 rounded-full">
              ไม่ระบุตัวตน
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-6 max-w-md mx-auto">
        <Card className="p-6 rounded-[24px] border border-border shadow-soft">
          {success ? (
            <div className="py-8 text-center">
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h2 className="text-lg font-extrabold text-text-main mb-2">ขอบคุณค่ะ!</h2>
              <p className="text-sm text-text-muted mb-6">ความคิดเห็นของคุณถูกส่งเรียบร้อยแล้ว</p>
              <Button
                onClick={() => setSuccess(false)}
                className="h-11 rounded-full bg-gradient-to-br from-primary to-primary-light text-white font-bold shadow-primary"
              >
                ส่งอีกครั้ง
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-text-main">บอกเราหน่อย</h2>
                  <p className="text-[11px] text-text-muted">แชร์ประสบการณ์ · แจ้งปัญหา · แนะนำฟีเจอร์</p>
                </div>
              </div>

              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="เล่าให้เราฟังว่าคิดอย่างไร..."
                className="w-full h-32 p-3 border border-border rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-surface"
              />

              {/* Image Upload */}
              <div className="mt-4">
                {feedbackImagePreview ? (
                  <div className="relative">
                    <img
                      src={feedbackImagePreview}
                      alt="รูปแนบ"
                      className="w-full h-32 object-cover rounded-2xl"
                    />
                    <button
                      onClick={() => {
                        setFeedbackImage(null);
                        setFeedbackImagePreview(null);
                      }}
                      aria-label="ลบรูปแนบ"
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:bg-surface-alt/30 transition-colors">
                    <ImagePlus className="w-5 h-5 text-text-muted" />
                    <span className="text-sm text-text-muted">แนบภาพหน้าจอ (ไม่บังคับ)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFeedbackImage(file);
                          setFeedbackImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={!feedbackText.trim() || submitting}
                className="w-full mt-6 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light text-white font-bold shadow-primary disabled:opacity-50"
              >
                {submitting ? "กำลังส่ง..." : "ส่งความคิดเห็น"}
              </Button>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}

function FeedbackLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<FeedbackLoading />}>
      <FeedbackContent />
    </Suspense>
  );
}
