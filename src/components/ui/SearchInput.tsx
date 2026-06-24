import { Search } from 'lucide-react';
import './SearchInput.css';

interface SearchInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ id, value, onChange, placeholder = 'Search…' }: SearchInputProps) {
  return (
    <div className="search-input-wrap">
      <Search size={16} className="search-input__icon" aria-hidden="true" />
      <input
        id={id}
        type="search"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
