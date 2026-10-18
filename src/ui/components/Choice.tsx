/** One choice among a few, as a row of buttons (e.g. a setting's options). */
export interface ChoiceProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  nameOf: (option: T) => string;
  onChange: (option: T) => void;
}

export function Choice<T extends string>({
  label,
  options,
  value,
  nameOf,
  onChange,
}: ChoiceProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={value === option ? 'segmented__option is-selected' : 'segmented__option'}
          onClick={() => onChange(option)}
        >
          {nameOf(option)}
        </button>
      ))}
    </div>
  );
}
