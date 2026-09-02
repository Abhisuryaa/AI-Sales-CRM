"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type CheckboxProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type" | "checked"
> & {
  /** Controlled checked state; "indeterminate" renders a dash. */
  checked: boolean | "indeterminate";
  /** shadcn-style change handler. */
  onCheckedChange?: (checked: boolean) => void;
};

function Checkbox({
  className,
  checked,
  onCheckedChange,
  onChange,
  disabled,
  ...props
}: CheckboxProps) {
  const state =
    checked === "indeterminate"
      ? "indeterminate"
      : checked
        ? "checked"
        : "unchecked";

  return (
    <span
      data-slot="checkbox"
      data-state={state}
      className="relative inline-flex items-center justify-center"
    >
      <input
        type="checkbox"
        data-slot="checkbox-input"
        aria-checked={checked === "indeterminate" ? "mixed" : checked}
        data-state={state}
        className="peer sr-only"
        checked={checked === "indeterminate" ? false : checked}
        disabled={disabled}
        onChange={(event) => {
          onCheckedChange?.(event.target.checked);
          onChange?.(event);
        }}
        {...props}
      />
      <span
        aria-hidden="true"
        data-state={state}
        className={cn(
          "border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border shadow-xs transition-[color,box-shadow] outline-none peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 peer-focus-visible:ring-[3px] peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          className
        )}
      >
        {checked === "indeterminate" ? (
          <span className="bg-primary-foreground h-0.5 w-2 rounded-full pointer-events-none" />
        ) : checked ? (
          <CheckIcon className="size-3 text-current pointer-events-none" />
        ) : null}
      </span>
    </span>
  );
}

export { Checkbox, type CheckboxProps };
