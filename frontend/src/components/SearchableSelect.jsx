import { useEffect, useRef, useState } from "react";

// A lightweight type-to-filter combobox. `options` items need `_id` and a
// `label` (pre-formatted display string) plus whatever payload the caller
// wants back in onSelect.
//
// The dropdown list is rendered with position:fixed (viewport coordinates
// computed from the input's own bounding rect) rather than position:absolute
// anchored to this component. That's deliberate: when this sits inside a
// horizontally-scrollable table wrapper (overflow-x:auto), the CSS spec
// forces overflow-y to auto too on that wrapper even if you don't ask for
// it, which would otherwise clip the popup instead of letting it float over
// the page.
export default function SearchableSelect({ options, placeholder, onSelect, value }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        !e.target.closest(".searchable-select-list")
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Since the list is viewport-positioned, it has to be re-anchored to the
    // input whenever anything scrolls (capture:true to catch scrolling
    // ancestors, not just the window) or the window resizes. Skip the list's
    // own internal overflow scrolling — that fires "scroll" too, and moving
    // the list while someone scrolls through its options would fight them.
    function reposition(e) {
      if (e?.target?.closest?.(".searchable-select-list")) return;
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom, left: rect.left, width: rect.width });
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function openDropdown() {
    const rect = inputRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom, left: rect.left, width: rect.width });
    setOpen(true);
  }

  const filtered =
    query.trim() === ""
      ? options.slice(0, 30)
      : options
          .filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
          .slice(0, 30);

  return (
    <div className="searchable-select" ref={containerRef}>
      <input
        ref={inputRef}
        value={query}
        placeholder={placeholder || "Type to search..."}
        onChange={(e) => {
          setQuery(e.target.value);
          openDropdown();
        }}
        onFocus={openDropdown}
      />
      {open && position && (
        <ul
          className="searchable-select-list"
          style={{ top: position.top, left: position.left, width: position.width }}
        >
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
