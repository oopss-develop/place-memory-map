import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";
const variants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "border-border text-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground",
};

export function Badge({ className, variant = "default", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)} {...props} />;
}
