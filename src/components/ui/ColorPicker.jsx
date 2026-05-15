import { DEFAULT_CATEGORY_COLORS } from '../../constants/defaults.js';

export default function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DEFAULT_CATEGORY_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Use ${color}`}
          className={`size-6 rounded border ${value === color ? 'border-ink' : 'border-line'}`}
          style={{ backgroundColor: color }}
          onClick={() => onChange?.(color)}
        />
      ))}
    </div>
  );
}
