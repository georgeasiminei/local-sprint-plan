export default function DependencyTooltip({ dependency }) {
  return (
    <div className="text-xs">
      <p className="font-medium">Dependency</p>
      <p className="text-slate-500">Lag {dependency?.lagWeeks ?? 0} weeks</p>
    </div>
  );
}
