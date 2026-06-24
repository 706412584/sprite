import type { ReactNode } from "react";

interface ToolPageShellProps {
  /** Tool title shown in the header. */
  title: string;
  /** Optional one-line description under the title. */
  subtitle?: ReactNode;
  /** Optional status chips/badges shown next to the title. */
  status?: ReactNode;
  /** Optional action buttons aligned to the right of the header. */
  actions?: ReactNode;
  /** Main tool body. */
  children: ReactNode;
  /** Extra class on the outer shell, for tool-specific layout tweaks. */
  className?: string;
}

/**
 * Shared layout shell for a workspace tool page.
 *
 * Centralises the header (title + subtitle + status + actions) and body
 * spacing that each tool panel used to reimplement on its own. Adopt this in
 * tool panels so headers, status, and actions stay visually consistent and
 * responsive in one place instead of drifting per panel.
 */
export function ToolPageShell({ title, subtitle, status, actions, children, className }: ToolPageShellProps) {
  return (
    <section className={`tool-page-shell${className ? ` ${className}` : ""}`}>
      <header className="tool-page-header">
        <div className="tool-page-heading">
          <div className="tool-page-title-row">
            <h3>{title}</h3>
            {status && <div className="tool-page-status">{status}</div>}
          </div>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="tool-page-actions">{actions}</div>}
      </header>
      <div className="tool-page-body">{children}</div>
    </section>
  );
}
