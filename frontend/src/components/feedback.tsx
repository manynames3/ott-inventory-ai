"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import { AlertCircle, Inbox, LoaderCircle, X } from "lucide-react";

export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <section className="state-panel state-loading" aria-busy="true" aria-live="polite">
      <LoaderCircle className="spin" size={22} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>Please wait while the latest workspace data loads.</span>
      </div>
      <div className="state-skeleton" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}

export function PageError({
  title = "Something went wrong",
  message,
  action
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <section className="state-panel state-error" role="alert">
      <AlertCircle size={22} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {action ? <div className="state-action">{action}</div> : null}
    </section>
  );
}

export function EmptyState({
  title,
  message,
  action
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <section className="state-panel state-empty" aria-live="polite">
      <Inbox size={22} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      {action ? <div className="state-action">{action}</div> : null}
    </section>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [busy, onCancel, open]);

  function keepFocusInDialog(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)"));
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={keepFocusInDialog}
      >
        <button className="dialog-close" type="button" aria-label="Close dialog" onClick={onCancel} disabled={busy}>
          <X size={18} />
        </button>
        <div className={destructive ? "dialog-icon destructive" : "dialog-icon"}>
          <AlertCircle size={22} aria-hidden="true" />
        </div>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="dialog-actions">
          <button ref={cancelButtonRef} className="button secondary" type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button className={destructive ? "button danger" : "button"} type="button" onClick={onConfirm} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
