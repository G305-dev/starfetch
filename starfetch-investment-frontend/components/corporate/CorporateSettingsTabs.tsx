import type { KeyboardEvent } from "react";
import { corporateSettingsTabs, type CorporateSettingsTabId } from "./corporate-settings-data";

type Props = {
  activeTab: CorporateSettingsTabId;
  onSelect: (tab: CorporateSettingsTabId) => void;
};

export function CorporateSettingsTabs({ activeTab, onSelect }: Props) {
  function moveWithArrow(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (currentIndex + direction + corporateSettingsTabs.length) % corporateSettingsTabs.length;
    const next = corporateSettingsTabs[nextIndex];
    onSelect(next.id);
    document.getElementById(`corporate-settings-tab-${next.id}`)?.focus();
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-star-200 bg-white">
      <div className="flex min-w-max px-2" role="tablist" aria-label="Corporate settings sections">
        {corporateSettingsTabs.map(({ id, label, icon: Icon }, index) => {
          const active = id === activeTab;
          return <button key={id} id={`corporate-settings-tab-${id}`} type="button" role="tab" aria-selected={active} aria-controls={`corporate-settings-panel-${id}`} tabIndex={active ? 0 : -1} onClick={() => onSelect(id)} onKeyDown={(event) => moveWithArrow(event, index)} className={`relative flex min-h-[56px] items-center gap-3 px-5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700 ${active ? "text-star-700" : "text-star-muted hover:bg-star-50 hover:text-star-700"}`}><Icon size={20} strokeWidth={1.9} aria-hidden="true" />{label}<span className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-full ${active ? "bg-star-700" : "bg-transparent"}`} aria-hidden="true" /></button>;
        })}
      </div>
    </div>
  );
}
