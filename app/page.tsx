"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { AuthForm } from "@/components/auth-form";
import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { getUserLikes } from "@/lib/db";
import { apiFetch } from "@/lib/api";
import { Heart, Loader2, Plus } from "lucide-react";
import { CreatePostForm } from "@/components/create-post-form";
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
      getUserLikes(user.id, data.map((p: FeedPost) => p.id)).then(({ data: liked }) => {
        setLikedPosts(new Set(liked));
      });
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const isLiked = likedPosts.has(postId);
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Optimistic toggle
    setLikedPosts((prev) => {
      const next = new Set(prev);
      isLiked ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts(posts.map((p) =>
      p.id === postId
        ? { ...p, likes_count: p.likes_count + (isLiked ? -1 : 1) }
        : p
    ));

    try {
      const { likes_count: newCount } = await apiFetch("/api/posts/like", {
        method: "POST",
        body: JSON.stringify({ postId }),
      });
      if (newCount !== undefined) {
        setPosts(posts.map((p) =>
          p.id === postId ? { ...p, likes_count: newCount } : p
        ));
      }
    } catch {
      // Revert on error
      setLikedPosts((prev) => {
        const next = new Set(prev);
        isLiked ? next.add(postId) : next.delete(postId);
        return next;
      });
      setPosts(posts.map((p) =>
        p.id === postId ? { ...p, likes_count: post.likes_count } : p
      ));
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold text-primary">Pawrent</h1>
        <p className="text-sm text-muted-foreground">Community Feed</p>
      </header>

      {/* Feed */}
      <main className="px-4 py-6 max-w-md mx-auto space-y-4">
        {showCreatePost ? (
          <CreatePostForm
            onSuccess={() => {
              setShowCreatePost(false);
              fetchPosts();
            }}
            onCancel={() => setShowCreatePost(false)}
          />
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">📸</span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">No posts yet</h2>
            <p className="text-muted-foreground mb-6">
              Be the first to share your pet's moment!
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="rounded-2xl overflow-hidden">
              {/* Post Header */}
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden relative">
                  {post.pets?.photo_url ? (
                    <Image src={post.pets.photo_url} alt="" fill className="object-cover" />
                  ) : (
                    <span className="text-lg">🐕</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{post.pets?.name || "Pet Parent"}</p>
                  <p className="text-xs text-muted-foreground">{post.pets?.breed || ""} • {formatTime(post.created_at)}</p>
                </div>
              </div>

              {/* Post Image */}
              <div className="aspect-square bg-muted relative">
                <Image src={post.image_url} alt="" fill className="object-cover" />
              </div>

              {/* Post Actions */}
              <div className="p-4">
                <button
                  onClick={() => handleLike(post.id)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Heart className={`w-6 h-6 ${likedPosts.has(post.id) ? "fill-destructive text-destructive" : ""}`} />
                  <span className="font-semibold">{post.likes_count}</span>
                </button>
                {post.caption && (
                  <p className="mt-2 text-foreground">
                    <span className="font-semibold">{post.pets?.name || "Someone"}</span>{" "}
                    {post.caption}
                  </p>
                )}
              </div>
            </Card>
          ))
        )}
      </main>

      {/* Floating Create Post Button */}
      {!showCreatePost && (
        <button
          onClick={() => setShowCreatePost(true)}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-primary text-white floating-shadow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-40"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <BottomNav />
    </div>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return <FeedContent />;
}
