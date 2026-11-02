import type { KeyboardEvent } from "react";
import { corporateProfileTabs, type CorporateProfileTabId } from "./company-profile-data";

type Props = {
  activeTab: CorporateProfileTabId;
  onSelect: (tab: CorporateProfileTabId) => void;
};

export function CorporateProfileTabs({ activeTab, onSelect }: Props) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + corporateProfileTabs.length) % corporateProfileTabs.length;
    const next = corporateProfileTabs[nextIndex];
    onSelect(next.id);
    document.getElementById(`corporate-tab-${next.id}`)?.focus();
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-star-200 bg-white"><div className="flex min-w-max px-2" role="tablist" aria-label="Company profile sections">{corporateProfileTabs.map((tab, index) => { const active = tab.id === activeTab; return <button key={tab.id} id={`corporate-tab-${tab.id}`} type="button" role="tab" aria-selected={active} aria-controls={`corporate-panel-${tab.id}`} tabIndex={active ? 0 : -1} onClick={() => onSelect(tab.id)} onKeyDown={(event) => handleKeyDown(event, index)} className={`relative min-h-12 whitespace-nowrap px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700 ${active ? "text-star-700" : "text-star-muted hover:bg-star-50 hover:text-star-700"}`}>{tab.label}<span className={`absolute inset-x-4 bottom-0 h-[3px] rounded-t-full ${active ? "bg-star-700" : "bg-transparent"}`} aria-hidden="true" /></button>; })}</div></div>
  );
}
