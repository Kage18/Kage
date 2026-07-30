import type { ReactElement, ReactNode } from "react";

// The page header: a title, an optional lede, an optional action on the title's line.
//
// NO ICON. It used to take one and render it beside the title, which put a lucide glyph at the top
// of every screen — and an icon set is a second visual vocabulary competing with the labels, rails
// and luminance ladder that already carry the meaning. The design has exactly one mark, the eye in
// the sidebar. Everything else is type.

export function PageHeader({
  title,
  lede,
  action,
}: {
  title: string;
  lede?: ReactNode;
  action?: ReactNode;
}): ReactElement {
  return (
    <header className="page-header">
      <div className="page-header-row">
        <h1>{title}</h1>
        {action}
      </div>
      {lede && <p className="page-subtitle">{lede}</p>}
    </header>
  );
}
