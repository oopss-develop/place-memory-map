"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { DropdownMenu } from "radix-ui";

interface PickerOption { value: string; label: string; detail?: string }

export function WorkspacePicker({ label, value, options, onChange, disabled, open, onOpenChange, action, searchable = true }: {
  label: string; value: string; options: PickerOption[]; onChange: (value: string) => void; disabled?: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void; action?: { label: string; onClick: () => void }; searchable?: boolean;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const [query, setQuery] = useState(""); const input = useRef<HTMLInputElement>(null);
  const filtered = options.filter(option => option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="group-picker workspace-picker">
    <DropdownMenu.Root open={open ?? localOpen} onOpenChange={onOpenChange ?? setLocalOpen}>
      <DropdownMenu.Trigger asChild><button className="group-picker-trigger" type="button" disabled={disabled} aria-label={label}><span>{options.find(option => option.value === value)?.label ?? "선택하세요"}</span><ChevronDown size={17} /></button></DropdownMenu.Trigger>
      <DropdownMenu.Content className="workspace-picker-content" sideOffset={6} align="start" collisionPadding={12} onCloseAutoFocus={() => setQuery("")}>
        {searchable && <input ref={input} className="workspace-picker-search" aria-label={label + " 검색"} placeholder="목록에서 검색" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); event.currentTarget.parentElement?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus(); } if (event.key !== "Escape" && event.key !== "Tab") event.stopPropagation(); }} />}
        {!filtered.length && <p className="picker-empty">검색 결과가 없습니다.</p>}
        <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
          {filtered.map(option => <DropdownMenu.RadioItem key={option.value} value={option.value} className="workspace-picker-option"><span className="workspace-picker-check"><DropdownMenu.ItemIndicator><Check size={16} /></DropdownMenu.ItemIndicator></span><span className="workspace-picker-option-label">{option.label}</span>{option.detail && <small>{option.detail}</small>}</DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
        {action && <><DropdownMenu.Separator className="workspace-picker-separator" /><DropdownMenu.Item className="workspace-picker-option workspace-picker-action" onSelect={action.onClick}><Plus size={16} />{action.label}</DropdownMenu.Item></>}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>;
}
