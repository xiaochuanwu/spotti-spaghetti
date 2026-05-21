import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useI18n } from '../../i18n';

const defaultGetId = (item) => item.id;
const defaultGetTitle = (item) => item.playlistName;

export const HistoryRecordSelect = ({
  getId = defaultGetId,
  getMeta,
  getTitle = defaultGetTitle,
  history,
  selectedId,
  selectedItem,
  onChange,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();
  const isDisabled = history.length === 0;
  const activeIndex = Math.max(0, Math.min(highlightedIndex, Math.max(history.length - 1, 0)));

  const getDefaultMeta = (item) => (
    `${new Date(item.createdAt).toLocaleString()} · ${item.trackCount} ${t('playlists.tracks')}`
  );
  const renderMeta = getMeta || getDefaultMeta;
  const selectedMeta = selectedItem ? renderMeta(selectedItem) : '';

  const getSelectedIndex = () => history.findIndex(item => getId(item) === selectedId);
  const getFallbackIndex = () => {
    const selectedIndex = getSelectedIndex();
    return selectedIndex >= 0 ? selectedIndex : 0;
  };

  const openMenu = (nextIndex = getFallbackIndex()) => {
    if (isDisabled) return;
    setHighlightedIndex(Math.max(0, Math.min(nextIndex, history.length - 1)));
    setIsOpen(true);
  };

  const closeMenu = (shouldFocusButton = false) => {
    setIsOpen(false);
    if (shouldFocusButton) {
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  };

  const selectIndex = (index) => {
    const item = history[index];
    if (!item) return;
    onChange(getId(item));
    closeMenu(true);
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenu(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, isOpen]);

  const moveHighlight = (offset) => {
    setHighlightedIndex(current => {
      const next = current + offset;
      if (next < 0) return history.length - 1;
      if (next >= history.length) return 0;
      return next;
    });
  };

  const handleButtonKeyDown = (event) => {
    if (isDisabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenu(getFallbackIndex());
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const selectedIndex = getSelectedIndex();
      openMenu(selectedIndex >= 0 ? selectedIndex : history.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) {
        selectIndex(activeIndex);
      } else {
        openMenu();
      }
    } else if (event.key === 'Escape') {
      closeMenu(false);
    }
  };

  const handleOptionKeyDown = (event, index) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(history.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectIndex(index);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      closeMenu(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (isOpen) {
            closeMenu(false);
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleButtonKeyDown}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        className="flex min-h-[58px] w-full items-center justify-between gap-3 rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-white dark:bg-[#1d1d1f] px-3 py-2 text-left text-sm text-[#1d1d1f] dark:text-[#f5f5f7] outline-none transition-colors hover:border-[#0071e3]/60 focus:border-[#0071e3] disabled:text-[#86868b]"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {selectedItem ? getTitle(selectedItem) : t('insights.noHistory')}
          </span>
          {selectedMeta && (
            <span className="mt-0.5 block truncate text-[11px] font-medium text-[#86868b]">
              {selectedMeta}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#86868b] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && !isDisabled && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-[#e5e5e7] dark:border-[#333336] bg-white/95 dark:bg-[#1d1d1f]/95 p-1.5 shadow-xl backdrop-blur-xl animate-fade-in"
        >
          {history.map((item, index) => {
            const itemId = getId(item);
            const selected = itemId === selectedId;
            const highlighted = index === activeIndex;
            const itemMeta = renderMeta(item);

            return (
              <button
                key={itemId}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={highlighted ? 0 : -1}
                onClick={() => selectIndex(index)}
                onMouseEnter={() => setHighlightedIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors ${
                  selected
                    ? 'bg-[#0071e3]/10 text-[#0071e3]'
                    : highlighted
                      ? 'bg-[#f5f5f7] text-[#1d1d1f] dark:bg-[#2d2d30] dark:text-[#f5f5f7]'
                      : 'text-[#1d1d1f] hover:bg-[#f5f5f7] dark:text-[#f5f5f7] dark:hover:bg-[#2d2d30]'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{getTitle(item)}</span>
                  {itemMeta && (
                    <span className="mt-0.5 block truncate text-[11px] font-medium text-[#86868b]">
                      {itemMeta}
                    </span>
                  )}
                </span>
                {selected && <Check size={15} className="shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
