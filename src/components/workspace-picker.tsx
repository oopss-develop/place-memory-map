"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { DropdownMenu } from "radix-ui";

interface PickerOption { value: string; label: string; detail?: string }

export function WorkspacePicker({ label, value, options, onChange, disabled, open, onOpenChange, action }: {
  label: string; value: string; options: PickerOption[]; onChange: (value: string) => void; disabled?: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void; action?: { label: string; onClick: () => void };
}) {
  const [localOpen, setLocalOpen] = useState(false);
  return <div className="group-picker workspace-picker">
    <DropdownMenu.Root open={open ?? localOpen} onOpenChange={onOpenChange ?? setLocalOpen}>
      <DropdownMenu.Trigger asChild><button className="group-picker-trigger" type="button" disabled={disabled} aria-label={label}><span>{options.find(option => option.value === value)?.label ?? "선택하세요"}</span><ChevronDown size={17} /></button></DropdownMenu.Trigger>
      <DropdownMenu.Content className="workspace-picker-content" sideOffset={6} align="start" collisionPadding={12}>
        <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
          {options.map(option => <DropdownMenu.RadioItem key={option.value} value={option.value} className="workspace-picker-option"><span className="workspace-picker-check"><DropdownMenu.ItemIndicator><Check size={16} /></DropdownMenu.ItemIndicator></span><span className="workspace-picker-option-label">{option.label}</span>{option.detail && <small>{option.detail}</small>}</DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
        {action && <><DropdownMenu.Separator className="workspace-picker-separator" /><DropdownMenu.Item className="workspace-picker-option workspace-picker-action" onSelect={action.onClick}><Plus size={16} />{action.label}</DropdownMenu.Item></>}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>;
}
