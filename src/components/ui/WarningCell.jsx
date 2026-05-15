import Tooltip from './Tooltip.jsx';

export default function WarningCell({ warning, children }) {
  if (!warning) {
    return children;
  }

  return (
    <Tooltip label={warning}>
      <span className="rounded bg-amber-100 px-1 text-amber-900">{children}</span>
    </Tooltip>
  );
}
