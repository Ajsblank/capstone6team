import React from "react";
import "./Breadcrumb.css";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface Props {
  items: BreadcrumbItem[];
  dark?: boolean;   // dark 배경용 (기본: 흰 배경)
}

const Breadcrumb: React.FC<Props> = ({ items, dark = false }) => (
  <nav className={`breadcrumb${dark ? " breadcrumb--dark" : ""}`} aria-label="breadcrumb">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="bc-sep" aria-hidden>›</span>}
        {item.onClick ? (
          <button className="bc-link" onClick={item.onClick}>
            {i === 0 && <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 11h1v6a1 1 0 001 1h4v-4h2v4h4a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z"/></svg>}
            {item.label}
          </button>
        ) : (
          <span className="bc-current" aria-current="page">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

export default Breadcrumb;
