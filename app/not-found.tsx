import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <span className="text-6xl mb-4">🐾</span>
      <h2 className="text-2xl font-bold text-foreground mb-2">Page not found</h2>
      <p className="text-muted-foreground text-center mb-6">
        This page doesn&#39;t exist or has been moved.
      </p>
      <Link href="/">
        <Button>Go home</Button>
      </Link>
    </div>
  );
}
