import { IconSearch, IconX } from './Icons';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  totalCount?: number;
}

export function SearchBar({ value, onChange, resultCount, totalCount }: SearchBarProps) {
  const showCount = value.trim().length > 0 && typeof resultCount === 'number';
  return (
    <div className="search" role="search">
      <span className="search__icon" aria-hidden="true">
        <IconSearch size={15} />
      </span>
      <input
        className="search__input"
        type="search"
        value={value}
        placeholder="Search skills, files and categories…"
        aria-label="Search skills, files and categories"
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
      {showCount && (
        <span className="search__count" aria-live="polite">
          {resultCount} of {totalCount}
        </span>
      )}
      {value && (
        <button className="search__clear" onClick={() => onChange('')} aria-label="Clear search">
          <IconX size={13} />
        </button>
      )}
    </div>
  );
}
