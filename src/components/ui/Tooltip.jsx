export default function Tooltip({ label, children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 -translate-y-1 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-white opacity-0 transition delay-100 duration-100 group-hover:translate-y-0 group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}
