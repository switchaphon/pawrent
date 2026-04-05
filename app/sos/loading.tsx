import { Loader2 } from "lucide-react";

export default function SOSLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );
}
