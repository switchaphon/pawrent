import { BottomNav } from "@/components/bottom-nav";
import { Card } from "@/components/ui/card";
import { Heart } from "lucide-react";

// Mock feed data
const mockPosts = [
  { id: "1", petName: "Luna", breed: "Golden Retriever", likes: 24 },
  { id: "2", petName: "Max", breed: "German Shepherd", likes: 18 },
  { id: "3", petName: "Bella", breed: "Poodle", likes: 32 },
  { id: "4", petName: "Charlie", breed: "Bulldog", likes: 15 },
];

export default function FeedPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border px-4 py-3">
        <h1 className="text-xl font-bold text-foreground">Community Feed</h1>
        <p className="text-sm text-muted-foreground">Pets in your area</p>
      </header>

      {/* Feed */}
      <main className="px-4 py-6 space-y-4 max-w-md mx-auto">
        {mockPosts.map((post) => (
          <Card key={post.id} className="overflow-hidden rounded-2xl">
            {/* Placeholder Image */}
            <div className="h-48 bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
              <span className="text-6xl">🐕</span>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">{post.petName}</h3>
                <p className="text-sm text-muted-foreground">{post.breed}</p>
              </div>
              <button className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <Heart className="w-5 h-5" />
                <span className="text-sm">{post.likes}</span>
              </button>
            </div>
          </Card>
        ))}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
