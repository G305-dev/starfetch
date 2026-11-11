import type { KeyboardEvent } from "react";
import { corporateDocumentCategories, corporateDocumentsByCategory, type DocumentCategoryId } from "./corporate-documents-data";

type Props = {
  activeCategory: DocumentCategoryId;
  onSelect: (category: DocumentCategoryId) => void;
};

export function CorporateDocumentTabs({ activeCategory, onSelect }: Props) {
  function moveWithArrow(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + corporateDocumentCategories.length) % corporateDocumentCategories.length;
    const nextCategory = corporateDocumentCategories[nextIndex];
    onSelect(nextCategory.id);
    document.getElementById(`corporate-documents-tab-${nextCategory.id}`)?.focus();
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-star-200 bg-white">
      <div className="flex min-w-max px-2" role="tablist" aria-label="Document categories">
        {corporateDocumentCategories.map(({ id, label, icon: Icon }, index) => {
          const active = id === activeCategory;
          const count = corporateDocumentsByCategory[id].length;
          return (
            <button
              key={id}
              id={`corporate-documents-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`corporate-documents-panel-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(id)}
              onKeyDown={(event) => moveWithArrow(event, index)}
              className={`relative flex min-h-[70px] items-center gap-3 px-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700 ${active ? "text-star-700" : "text-star-muted hover:bg-star-50 hover:text-star-700"}`}
            >
              <Icon size={23} strokeWidth={1.9} aria-hidden="true" />
              <span><span className="block text-sm font-extrabold leading-5">{label}</span><span className="mt-0.5 block text-xs font-medium">{count} documents</span></span>
              <span className={`absolute inset-x-3 bottom-0 h-1 rounded-t-full ${active ? "bg-star-700" : "bg-transparent"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
