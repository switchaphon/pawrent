"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/liff-provider";
import { supabase } from "@/lib/supabase";
import { getUserLikes } from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { Heart, Plus, PawPrint, AlertTriangle } from "lucide-react";
import { CreatePostForm } from "@/components/create-post-form";
import { EmptyState } from "@/components/empty-state";
import { SkeletonCard } from "@/components/skeleton-card";
import Image from "next/image";

interface FeedPost {
  id: string;
  pet_id: string | null;
  owner_id: string;
  image_url: string;
  caption: string | null;
  likes_count: number;
  created_at: string;
  pets?: {
    name: string;
    breed: string | null;
    photo_url: string | null;
  } | null;
}

function formatTimeThai(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "เมื่อสักครู่";
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return `${Math.floor(diffDays / 7)} สัปดาห์ที่แล้ว`;
}

function GreetingHeader() {
  return (
    <div className="owner-bubble px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-pops-gradient flex items-center justify-center text-white font-bold text-sm shadow-glow">
        <span aria-hidden>🐾</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text-main text-sm truncate">สวัสดีชาวป๊อปส์</p>
        <p className="text-[11px] text-text-muted">พบเห็นความเคลื่อนไหวของเพื่อน ๆ รอบตัว</p>
      </div>
    </div>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        href="/post/lost"
        className="flex items-center gap-2 bg-surface border border-border rounded-[20px] shadow-soft p-4 hover:brightness-105 active:scale-95 transition-all"
      >
        <div className="w-10 h-10 rounded-full bg-danger-bg flex items-center justify-center text-danger flex-shrink-0">
          <AlertTriangle className="w-5 h-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-main truncate">แจ้งน้องหาย</p>
          <p className="text-[10px] text-text-muted truncate">เริ่มตามหาเดี๋ยวนี้</p>
        </div>
      </Link>
      <Link
        href="/pets"
        className="flex items-center gap-2 bg-surface border border-border rounded-[20px] shadow-soft p-4 hover:brightness-105 active:scale-95 transition-all"
      >
        <div className="w-10 h-10 rounded-full bg-primary-gradient flex items-center justify-center text-white flex-shrink-0 shadow-primary">
          <PawPrint className="w-5 h-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-main truncate">น้องของฉัน</p>
          <p className="text-[10px] text-text-muted truncate">พาสปอร์ต + สุขภาพ</p>
        </div>
      </Link>
    </div>
  );
}

function FeedContent() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*, pets(name, breed, photo_url)")
      .order("created_at", { ascending: false })
      .limit(20);
    setPosts(data || []);
    setLoading(false);

    if (user && data && data.length > 0) {
      getUserLikes(
        user.id,
        data.map((p: FeedPost) => p.id)
      ).then(({ data: liked }) => {
        setLikedPosts(new Set(liked));
      });
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedPosts.has(postId);
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    setLikedPosts((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setPosts(
      posts.map((p) =>
        p.id === postId ? { ...p, likes_count: p.likes_count + (isLiked ? -1 : 1) } : p
      )
    );

    try {
      const { likes_count: newCount } = await apiFetch("/api/posts/like", {
        method: "POST",
        body: JSON.stringify({ postId }),
      });
      if (newCount !== undefined) {
        setPosts(posts.map((p) => (p.id === postId ? { ...p, likes_count: newCount } : p)));
      }
    } catch {
      setLikedPosts((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setPosts(posts.map((p) => (p.id === postId ? { ...p, likes_count: post.likes_count } : p)));
    }
  };

  useEffect(() => {
    void fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen-safe">
      <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold text-primary">Pawrent</h1>
        <p className="text-xs text-text-muted">ชุมชนสัตว์เลี้ยงไทย</p>
      </header>

      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        <GreetingHeader />
        {user ? null : null}
        <QuickActions />

        <div>
          <h2 className="text-sm font-bold text-text-main mb-2 px-1">ความเคลื่อนไหวล่าสุด</h2>
          {showCreatePost ? (
            <CreatePostForm
              onSuccess={() => {
                setShowCreatePost(false);
                fetchPosts();
              }}
              onCancel={() => setShowCreatePost(false)}
            />
          ) : loading ? (
            <div className="space-y-4">
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              emoji="📸"
              title="ยังไม่มีโพสต์"
              description="มาเป็นคนแรกที่แชร์ช่วงเวลาของน้องกันเถอะ!"
              action={
                <button
                  type="button"
                  onClick={() => setShowCreatePost(true)}
                  className="inline-flex items-center gap-1 bg-primary-gradient text-white font-bold rounded-full px-5 py-2 shadow-primary touch-target"
                >
                  <Plus className="w-4 h-4" aria-hidden />
                  สร้างโพสต์
                </button>
              }
            />
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="bg-surface border border-border rounded-[24px] shadow-soft overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 rounded-full bg-pops-gradient p-[2px] overflow-hidden relative">
                      <div className="w-full h-full rounded-full bg-surface overflow-hidden">
                        {post.pets?.photo_url ? (
                          <Image src={post.pets.photo_url} alt="" fill className="object-cover" />
                        ) : (
                          <span
                            className="flex items-center justify-center h-full text-lg"
                            aria-hidden
                          >
                            🐕
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-text-main text-sm truncate">
                        {post.pets?.name || "เพื่อนผู้เลี้ยง"}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">
                        {post.pets?.breed || ""} · {formatTimeThai(post.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="aspect-square bg-surface-alt relative">
                    <Image src={post.image_url} alt="" fill className="object-cover" />
                  </div>

                  <div className="p-4">
                    <button
                      type="button"
                      onClick={() => handleLike(post.id)}
                      aria-label={likedPosts.has(post.id) ? "ยกเลิกถูกใจ" : "ถูกใจ"}
                      className="flex items-center gap-2 text-text-muted hover:text-danger transition-colors touch-target"
                    >
                      <Heart
                        className={`w-6 h-6 ${likedPosts.has(post.id) ? "fill-danger text-danger" : ""}`}
                        aria-hidden
                      />
                      <span className="font-bold text-sm">{post.likes_count}</span>
                    </button>
                    {post.caption && (
                      <p className="mt-2 text-text-main text-sm leading-relaxed">
                        <span className="font-bold">{post.pets?.name || "เพื่อนเรา"}</span>{" "}
                        {post.caption}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {!showCreatePost && (
        <button
          type="button"
          onClick={() => setShowCreatePost(true)}
          aria-label="สร้างโพสต์"
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary-gradient text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40 shadow-primary touch-target"
        >
          <Plus className="w-6 h-6" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen-safe flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-pops-gradient shadow-glow flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl" aria-hidden>
              🐾
            </span>
          </div>
          <p className="text-text-muted text-sm">กำลังเข้าสู่ระบบ…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen-safe flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-pops-gradient shadow-glow flex items-center justify-center mx-auto animate-pulse">
            <span className="text-2xl" aria-hidden>
              🐾
            </span>
          </div>
          <p className="text-text-muted text-sm">กำลังเข้าสู่ระบบผ่าน LINE…</p>
        </div>
      </div>
    );
  }

  return <FeedContent />;
}
