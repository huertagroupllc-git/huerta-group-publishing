"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useFormStatus } from "react-dom";
import { PrimaryButton } from "@/components/editorial";
import { pendingPresentation } from "@/lib/pending-submit";

/**
 * The house primary button, aware of its form's in-flight request:
 * while the server action is pending it is truly disabled (no repeated
 * activation), says so in words (the in-progress label), and announces
 * the change politely. When the action completes — success navigates,
 * failure re-renders with its message — the form is fresh and the
 * button is ordinary again. Local interaction state only; it asserts
 * nothing about the record.
 */
export function PendingSubmit({
  label,
  pendingLabel,
  className = "",
  ...props
}: Omit<ComponentPropsWithoutRef<"button">, "children" | "disabled"> & {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const view = pendingPresentation({ pending, label, pendingLabel });
  return (
    <>
      <PrimaryButton
        disabled={view.disabled}
        aria-disabled={view.disabled}
        aria-busy={view.busy}
        className={`disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-oxblood ${className}`}
        {...props}
      >
        {view.text}
      </PrimaryButton>
      <span role="status" aria-live="polite" className="sr-only">
        {view.announcement ?? ""}
      </span>
    </>
  );
}
