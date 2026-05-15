export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'border-focus bg-focus text-white hover:bg-blue-700',
    secondary: 'border-line bg-white text-ink hover:bg-panel',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-panel hover:text-ink',
  };

  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-2 rounded border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
