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
          <button className="bc-link" onClick={item.onClick}>{item.label}</button>
        ) : (
          <span className="bc-current" aria-current="page">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

export default Breadcrumb;
