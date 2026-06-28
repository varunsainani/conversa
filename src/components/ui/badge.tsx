import { cn } from "@/lib/utils";

export function Badge({
  children,
  color,
  className,
  variant = "soft",
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
  variant?: "soft" | "outline" | "dot";
}) {
  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color ?? "var(--color-muted-foreground)" }}
        />
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "outline" ? "border" : "",
        className,
      )}
      style={
        color
          ? variant === "outline"
            ? { color, borderColor: color }
            : { color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }
          : undefined
      }
    >
      {children}
    </span>
  );
}
