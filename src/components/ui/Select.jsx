export default function Select({ children, className = '', ...props }) {
  return (
    <select
      className={`h-9 rounded border border-line bg-white px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus/20 focus:ring-offset-1 focus:ring-offset-white ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
