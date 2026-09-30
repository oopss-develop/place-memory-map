"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ComboBoxOption { value: string; label: string; description?: string }

export function ComboBox({ value, options, placeholder = "선택하세요", onChange, disabled, className }: { value?: string; options: ComboBoxOption[]; placeholder?: string; onChange: (value: string) => void; disabled?: boolean; className?: string }) {
  const selected = options.find((option) => option.value === value);
  return <div className={cn("relative", className)}><Button type="button" variant="outline" disabled={disabled} className="w-full justify-between font-normal" aria-haspopup="listbox"><span className={cn(!selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span><ChevronsUpDown className="size-4 opacity-50" /></Button><div role="listbox" className="absolute z-20 mt-1 hidden max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md focus:outline-none"><div className="px-2 py-1.5 text-xs text-muted-foreground">선택 목록</div>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => onChange(option.value)} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"><Check className={cn("size-4", option.value === value ? "opacity-100" : "opacity-0")} /><span>{option.label}</span></button>)}</div></div>;
}
