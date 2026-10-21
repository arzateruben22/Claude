import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClasses =
  "w-full h-10 rounded-ctl bg-bg-elevated border border-line px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClasses, className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClasses, "h-auto min-h-24 py-2", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(inputClasses, "appearance-none pr-8 bg-no-repeat bg-[right_0.6rem_center]", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-xs font-medium text-fg-muted mb-1.5", className)} {...props} />;
}

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-danger">
      {errors[0]}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  errors,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  errors?: string[];
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !errors?.length && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
      <FieldError errors={errors} />
    </div>
  );
}

export function Checkbox({ className, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-fg cursor-pointer", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-line-strong accent-[var(--accent)]" {...props} />
      <span>{label}</span>
    </label>
  );
}
