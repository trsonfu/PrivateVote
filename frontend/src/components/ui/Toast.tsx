import { useEffect, type ReactNode } from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastProps = {
  open: boolean;
  message?: string;
  variant?: ToastVariant;
  autoHideMs?: number;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
};

const variantClassMap: Record<ToastVariant, string> = {
  success: "toast--success",
  error: "toast--error",
  info: "toast--info",
};

const join = (...classes: Array<string | undefined | false>) => classes.filter(Boolean).join(" ");

export function Toast({
  open,
  message,
  variant = "info",
  autoHideMs = 0,
  onClose,
  actionLabel,
  onAction,
  className,
  children,
}: ToastProps) {
  useEffect(() => {
    if (!open || !autoHideMs) return;
    const id = window.setTimeout(() => {
      onClose?.();
    }, autoHideMs);
    return () => window.clearTimeout(id);
  }, [open, autoHideMs, onClose]);

  if (!open) return null;

  return (
    <div className={join("toast", variantClassMap[variant], className)}>
      <div className="toast__body">
        {children ?? message}
        {actionLabel && onAction && (
          <button type="button" className="toast__action" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
      <button type="button" className="toast__close" onClick={onClose} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
}

export default Toast;

