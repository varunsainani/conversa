import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

export function LoadingScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center py-16 text-muted-foreground">
      <Spinner className="h-5 w-5" />
    </div>
  );
}
