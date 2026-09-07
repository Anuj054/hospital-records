import { useEffect, useRef, useState } from "react";

// A lightweight type-to-filter combobox. `options` items need `_id` and a
// `label` (pre-formatted display string) plus whatever payload the caller
// wants back in onSelect.
export default function SearchableSelect({ options, placeholder, onSelect, value }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered =
    query.trim() === ""
      ? options.slice(0, 30)
      : options
          .filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 30);

  return (
    <div className="searchable-select" ref={containerRef}>
      <input
        value={query}
        placeholder={placeholder || "Type to search..."}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <ul className="searchable-select-list">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <li
                key={opt._id}
                onMouseDown={() => {
                  onSelect(opt);
                  setQuery(opt.label);
                  setOpen(false);
                }}
              >
                {opt.label}
              </li>
            ))
          ) : (
            <li className="searchable-select-empty">
              {options.length === 0
                ? "No items in the catalog yet — add one under Medicines & Services, or type a custom item name."
                : "No matches — type a custom item name instead."}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
