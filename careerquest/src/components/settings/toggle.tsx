import type { ChangeEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accessible switch: a real checkbox (role="switch") with a visual track. Works without JS. */
export function Toggle({
  id,
  name,
  label,
  description,
  defaultChecked,
  checked,
  onChange,
  disabled,
  className,
}: {
  id: string;
  name: string;
  label: ReactNode;
  description?: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={id} className={cn("flex items-start justify-between gap-4 py-3 cursor-pointer", disabled && "opacity-60 cursor-not-allowed", className)}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description && <span className="block text-xs text-fg-muted mt-0.5">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0 mt-0.5">
        <input
          id={id}
          name={name}
          type="checkbox"
          role="switch"
          defaultChecked={defaultChecked}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "relative h-6 w-11 rounded-full border border-line bg-surface-strong transition-colors",
            "peer-checked:bg-accent peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40",
            "after:absolute after:top-0.5 after:left-0.5 after:h-[18px] after:w-[18px] after:rounded-full after:bg-fg-muted after:transition-transform after:content-['']",
            "peer-checked:after:translate-x-5 peer-checked:after:bg-accent-fg",
          )}
        />
      </span>
    </label>
  );
}
