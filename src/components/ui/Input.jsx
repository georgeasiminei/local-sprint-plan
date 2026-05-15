import { forwardRef } from 'react';

const Input = forwardRef(function Input({ as: Component = 'input', className = '', ...props }, ref) {
  return (
    <Component
      ref={ref}
      className={`h-9 rounded border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-focus/20 focus:ring-offset-1 focus:ring-offset-white ${className}`}
      {...props}
    />
  );
});

export default Input;
