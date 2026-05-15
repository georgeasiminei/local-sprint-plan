import { Children, isValidElement } from 'react';

export default function Button({ children, variant = 'primary', className = '', title, tooltip, ...props }) {
  const variants = {
    primary: 'border-focus bg-focus text-white hover:bg-blue-700',
    secondary: 'border-line bg-white text-ink hover:bg-panel',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-panel hover:text-ink',
  };
  const tooltipLabel = tooltip ?? title ?? props['aria-label'] ?? extractText(children);

  return (
    <button
      type="button"
      className={`app-tooltip inline-flex h-9 items-center justify-center gap-2 rounded border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      data-tooltip={tooltipLabel || undefined}
      {...props}
    >
      {children}
    </button>
  );
}

function extractText(children) {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }

      if (isValidElement(child)) {
        return extractText(child.props.children);
      }

      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
