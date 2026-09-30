import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RadioGroup({ className, children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return <div role="radiogroup" className={cn("grid gap-2", className)} {...props}>{children}</div>;
}

export function RadioGroupItem({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="radio" className={cn("peer size-4 shrink-0 appearance-none rounded-full border border-primary text-primary shadow-sm ring-offset-background checked:border-[5px] checked:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
}
