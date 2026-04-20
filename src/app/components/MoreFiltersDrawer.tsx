import { useEffect } from "react";
import { X } from "lucide-react";
import type { BrowseMoreFiltersState } from "../utils/browseListingQuery";

type MoreFiltersDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  value: BrowseMoreFiltersState;
  onChange: (next: BrowseMoreFiltersState) => void;
  onApply: () => void;
  onReset: () => void;
  idPrefix?: string;
};

export default function MoreFiltersDrawer({
  open,
  onClose,
  title = "More filters",
  value,
  onChange,
  onApply,
  onReset,
  idPrefix = "more-filters",
}: MoreFiltersDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      aria-modal={open}
      role="dialog"
      aria-labelledby={`${idPrefix}-title`}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close filters"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <div
        className={`fixed inset-y-0 right-0 z-[51] flex w-full max-w-md transform flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 id={`${idPrefix}-title`} className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <label htmlFor={`${idPrefix}-location`} className="block text-sm font-medium text-gray-700">
            Location
          </label>
          <p className="mb-1 text-xs text-gray-500">Match text in the listing location field.</p>
          <input
            id={`${idPrefix}-location`}
            type="text"
            value={value.locationContains}
            onChange={(e) => onChange({ ...value, locationContains: e.target.value })}
            placeholder="e.g. Lagos, Ikeja"
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            autoComplete="off"
          />

          <label htmlFor={`${idPrefix}-brand`} className="block text-sm font-medium text-gray-700">
            Brand
          </label>
          <p className="mb-1 text-xs text-gray-500">Partial match on vehicle brand when listed.</p>
          <input
            id={`${idPrefix}-brand`}
            type="text"
            value={value.brandContains}
            onChange={(e) => onChange({ ...value, brandContains: e.target.value })}
            placeholder="e.g. Toyota"
            className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
            autoComplete="off"
          />

          <label htmlFor={`${idPrefix}-delivery`} className="block text-sm font-medium text-gray-700">
            Delivery
          </label>
          <select
            id={`${idPrefix}-delivery`}
            value={value.deliveryMode}
            onChange={(e) =>
              onChange({
                ...value,
                deliveryMode: e.target.value === "has_options" ? "has_options" : "all",
              })
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
          >
            <option value="all">Any</option>
            <option value="has_options">Has delivery options listed</option>
          </select>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              onReset();
            }}
            className="order-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:order-1"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="order-3 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 sm:order-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            className="order-1 rounded-lg bg-[#16a34a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803d] sm:order-3"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
