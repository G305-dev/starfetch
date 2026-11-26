"use client";

/**
 * NOTIFICATION CENTER — prepared interface.
 *
 * Nine subviews: Overview, Compose, Audience, Templates, Automated events,
 * Scheduled, Delivery history, Failed deliveries, Channels.
 *
 * The brief names this section first because it has the most surface area, and
 * because it carries the easiest lie to tell: a "Send" button that looks like it
 * worked. Nothing here sends. The compose form is fully usable — typing, channel
 * selection, scheduling, preview, validation — and the final submit is inert with
 * the reason stated.
 *
 * Delivery state follows `lib/admin/notifications.ts`: `sent` is never rendered as
 * `delivered`, and a retry is only offered for `failed`.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  AUDIENCES,
  CHANNELS,
  SUPPORTED_PLACEHOLDERS,
  anyChannelConfirmed,
  audienceLabel,
  canSubmit,
  channelAvailability,
  channelLabel,
  channelState,
  channelStateLabel,
  describeCount,
  emptyDraft,
  missingPlaceholders,
  templatePlaceholders,
  validateDraft,
  validateTemplate,
  type Audience,
  type Channel,
  type ContractState,
  type NotificationDraft,
} from "@/lib/admin/prepared";
import { deliveryLabel, isConfirmedDelivered, type DeliveryState } from "@/lib/admin/notifications";
import {
  Card,
  DataTable,
  EvidenceBlock,
  FieldGrid,
  InertNote,
  IntegrationBadge,
  PreparedAction,
  SectionHeading,
  StatusPill,
  SubTabs,
  TabPanel,
  Toolbar,
  button,
  input,
  secondary,
  type Column,
} from "./UI";



/** Delivery-state presentation. `sent` and `delivered` must never look alike. */
function deliveryTone(state: DeliveryState) {
  switch (state) {
    case "delivered":
      return "positive" as const;
    case "sent":
      return "info" as const;
    case "queued":
      return "neutral" as const;
    case "scheduled":
      return "caution" as const;
    case "failed":
      return "danger" as const;
    case "cancelled":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

type Row = {
  id: string;
  title: string;
  audience: string;
  channel: string;
  state: DeliveryState;
  scheduledFor: string | null;
  failureReason: string | null;
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "compose", label: "Compose" },
  { key: "templates", label: "Templates" },
  { key: "automated", label: "Automated events" },
  { key: "scheduled", label: "Scheduled" },
  { key: "history", label: "Delivery history" },
  { key: "failed", label: "Failed deliveries" },
  { key: "channels", label: "Channels" },
] as const;

export function NotificationCenter({
  contract,
  initialTab = "overview",
}: {
  contract: ContractState;
  /** Which subview to open first. Exposed so tests can render a specific view. */
  initialTab?: string;
}) {
  const [active, setActive] = useState<string>(initialTab);
  // No records: the backend has not returned any, so there are none to show.
  const notifications: Row[] = [];
  const failures = notifications.filter((n) => n.state === "failed");

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Notification Center"
          description="Compose and review investor and staff notifications across the channels the backend has confirmed for delivery. No channel is confirmed yet, so every send path is blocked. Delivery and read state are kept strictly separate."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          {CHANNELS.map((channel) => {
            const { state } = channelAvailability(channel);
            return (
              <StatusPill key={channel} tone={state === "confirmed" ? "positive" : "caution"}>
                {channelLabel(channel)} — {channelStateLabel(state).toLowerCase()}
              </StatusPill>
            );
          })}
        </div>
        {!anyChannelConfirmed() && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">
            No notification channel has been confirmed by the backend. Every channel below is shown as integration
            pending, and a notification cannot be submitted until an approved backend contract confirms delivery for
            at least one channel.
          </p>
        )}
      </Card>

      <SubTabs
        tabs={TABS.map((t) => ({ ...t, count: t.key === "failed" ? failures.length : undefined }))}
        active={active}
        onChange={setActive}
      />

      <TabPanel id="overview" active={active}>
        <OverviewPanel contract={contract} notifications={notifications} onCompose={() => setActive("compose")} />
      </TabPanel>

      <TabPanel id="compose" active={active}>
        <ComposePanel contract={contract} />
      </TabPanel>

      <TabPanel id="templates" active={active}>
        <TemplatesPanel contract={contract} />
      </TabPanel>

      <TabPanel id="automated" active={active}>
        <AutomatedPanel contract={contract} />
      </TabPanel>

      <TabPanel id="scheduled" active={active}>
        <DeliveryTable
          title="Scheduled and in-flight"
          description="Notifications that have an approved send time and have not yet completed delivery."
          rows={notifications.filter((n) => n.state === "scheduled" || n.state === "queued")}
          contract={contract}
          emptyDetail="No notification has been scheduled. The backend supplies this list once the notification contract is approved."
        />
      </TabPanel>

      <TabPanel id="history" active={active}>
        <DeliveryTable
          title="Delivery history"
          description="Every send attempt with its confirmed delivery state. A sent notification is not a delivered one."
          rows={notifications}
          contract={contract}
          emptyDetail="Delivery history requires the backend delivery-log endpoint. No attempts are recorded yet."
        />
      </TabPanel>

      <TabPanel id="failed" active={active}>
        <DeliveryTable
          title="Failed deliveries"
          description="Notifications the provider rejected. Only a failed delivery may be retried."
          rows={failures}
          contract={contract}
          showRetry
          emptyDetail="No failed deliveries. Failure reasons appear here once the backend reports them, with secrets redacted."
        />
      </TabPanel>

      <TabPanel id="channels" active={active}>
        <ChannelsPanel />
      </TabPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------

function OverviewPanel({
  contract,
  notifications,
  onCompose,
}: {
  contract: ContractState;
  notifications: Row[];
  onCompose: () => void;
}) {
  const counts = useMemo(() => {
    const delivered = notifications.filter((n) => isConfirmedDelivered(n.state)).length;
    const sentNotDelivered = notifications.filter((n) => n.state === "sent").length;
    const failed = notifications.filter((n) => n.state === "failed").length;
    return { delivered, sentNotDelivered, failed };
  }, [notifications]);

  const tiles = [
    { label: "Confirmed delivered", value: notifications.length === 0 ? null : counts.delivered, icon: CheckCircle2, tone: "positive" as const, note: "Provider confirmed arrival" },
    { label: "Sent, not yet confirmed", value: notifications.length === 0 ? null : counts.sentNotDelivered, icon: Send, tone: "info" as const, note: "Accepted by the provider only" },
    { label: "Failed", value: notifications.length === 0 ? null : counts.failed, icon: AlertTriangle, tone: "danger" as const, note: "Retry available" },
    { label: "Scheduled", value: notifications.length === 0 ? null : notifications.filter((n) => n.state === "scheduled").length, icon: Clock, tone: "caution" as const, note: "Awaiting send time" },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-star-muted">{tile.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-star-900">
                  {tile.value == null ? "—" : tile.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[11px] text-star-muted">{tile.note}</p>
              </div>
              <tile.icon size={18} aria-hidden="true" className="shrink-0 text-star-muted" />
            </div>
            {tile.value == null && (
              <p className="mt-2 text-[11px] leading-4 text-amber-800">
                Awaiting the backend. Shown as a dash rather than 0 because nobody has counted yet.
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <SectionHeading
          title="Quick actions"
          description="Start a notification or review what is waiting. Every action here is prepared, not connected."
          action={
            <PreparedAction contract={contract} onClick={onCompose} variant="secondary">
              <Plus size={14} aria-hidden="true" /> Compose
            </PreparedAction>
          }
        />
        <InertNote contract={contract} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["Compose and preview a notification", "Drafts stay local until the contract is approved"],
            ["Approve a pending notification", "Maker and checker must be different staff"],
            ["Retry a failed delivery", "Only failed sends may be retried"],
            ["Edit a template", "Placeholders are validated against the supported set"],
          ].map(([label, note]) => (
            <div key={label} className="rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3">
              <p className="text-xs font-bold text-star-900">{label}</p>
              <p className="mt-0.5 text-[11px] text-star-muted">{note}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

function ComposePanel({ contract }: { contract: ContractState }) {
  const [draft, setDraft] = useState<NotificationDraft>(emptyDraft());
  const [showPreview, setShowPreview] = useState(false);
  const [nowIso, setNowIso] = useState("");
  useEffect(() => {
    const updateClock = () => setNowIso(new Date().toISOString());
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  const issues = validateDraft(draft, nowIso);
  const rawSubmit = canSubmit(draft, nowIso, contract);
  // Belt and braces: even if a draft somehow validated, no channel is confirmed,
  // so there is no delivery path. The submit control stays disabled and states why.
  const submit = anyChannelConfirmed()
    ? rawSubmit
    : {
        allowed: false,
        reason:
          "No notification channel has been confirmed by the backend, so nothing can be submitted for delivery yet.",
      };
  const placeholdersNeeded = templatePlaceholders(draft.body);
  const placeholdersMissing = missingPlaceholders(draft.body, [...SUPPORTED_PLACEHOLDERS]);

  function toggleChannel(channel: Channel) {
    setDraft((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((c) => c !== channel)
        : [...current.channels, channel],
    }));
  }

  return (
    <>
      <Card>
        <SectionHeading
          title="Compose notification"
          description="Write the message, choose channels and an audience, then optionally schedule it. Validation runs as you type; submission waits for the backend."
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-3">
            <label className="block text-xs font-bold">
              Title
              <input
                className={input + " mt-1"}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                maxLength={140}
                placeholder="Shown as the notification subject, e.g. Your statement is ready"
              />
              <span className="mt-1 block text-[11px] font-normal text-star-muted">
                {draft.title.trim().length}/140 characters
              </span>
            </label>

            <label className="block text-xs font-bold">
              Message body
              <textarea
                className={input + " mt-1 font-normal"}
                rows={8}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                maxLength={5000}
                placeholder="Write the message. Use {{firstName}} to personalise it."
              />
              <span className="mt-1 block text-[11px] font-normal text-star-muted">
                {draft.body.trim().length}/5000 characters
              </span>
            </label>

            <div className="rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3">
              <p className="text-[11px] font-extrabold text-star-900">Supported placeholders</p>
              <p className="mt-1 text-[11px] leading-4 text-star-muted">
                These are filled by the notification engine. Anything else is refused, because an investor would
                otherwise see the raw token.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUPPORTED_PLACEHOLDERS.map((name) => (
                  <code key={name} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-star-700 ring-1 ring-star-200">
                    {"{{"}
                    {name}
                    {"}}"}
                  </code>
                ))}
              </div>
              {placeholdersNeeded.length > 0 && (
                <p className="mt-2 text-[11px] text-star-muted">
                  Detected in this message: {placeholdersNeeded.map((p) => `{{${p}}}`).join(", ")}
                  {placeholdersMissing.length > 0 && (
                    <>
                      {" · "}
                      <span className="font-bold text-amber-800">
                        {placeholdersMissing.length} not yet supplied by the engine
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>

            <label className="block text-xs font-bold">
              Call-to-action link <span className="font-normal text-star-muted">(optional)</span>
              <input
                className={input + " mt-1 font-normal"}
                value={draft.ctaUrl ?? ""}
                onChange={(e) => setDraft({ ...draft, ctaUrl: e.target.value || null })}
                placeholder="https://starfetch.ng/…"
                inputMode="url"
              />
              <span className="mt-1 block text-[11px] font-normal text-star-muted">
                Must be a full https:// link. Other schemes are refused because this opens in an investor's client.
              </span>
            </label>
          </div>

          <div className="space-y-3">
            <fieldset className="rounded-lg border border-[#e7ece7] p-3">
              <legend className="px-1 text-xs font-extrabold text-star-900">Channels</legend>
              <div className="mt-1 space-y-1.5">
                {CHANNELS.map((channel) => {
                  const availability = channelAvailability(channel);
                  const checked = draft.channels.includes(channel);
                  return (
                    <label
                      key={channel}
                      className={
                        "flex items-start gap-2 rounded p-1 " +
                        (availability.selectable ? "cursor-pointer" : "cursor-not-allowed opacity-70")
                      }
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        disabled={!availability.selectable}
                        onChange={() => toggleChannel(channel)}
                      />
                      <span className="text-xs font-bold text-star-900">
                        {channelLabel(channel)}
                        {!availability.selectable && (
                          <span className="mt-0.5 block text-[10px] font-semibold text-amber-800">
                            {availability.note}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="block rounded-lg border border-[#e7ece7] p-3 text-xs font-bold">
              Audience
              <select
                className={input + " mt-1"}
                value={draft.audience}
                onChange={(e) => setDraft({ ...draft, audience: e.target.value as Audience | "" })}
              >
                <option value="">Choose an audience</option>
                {AUDIENCES.map((audience) => (
                  <option key={audience} value={audience}>
                    {audienceLabel(audience)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-star-muted">
                {describeCount(null)}
              </span>
            </label>

            <label className="block rounded-lg border border-[#e7ece7] p-3 text-xs font-bold">
              Send time
              <input
                type="datetime-local"
                className={input + " mt-1"}
                value={draft.scheduleAt ? draft.scheduleAt.slice(0, 16) : ""}
                onChange={(e) =>
                  setDraft({ ...draft, scheduleAt: e.target.value ? new Date(e.target.value).toISOString() : null })
                }
              />
              <span className="mt-1 block text-[11px] font-normal text-star-muted">
                Leave empty to send as soon as it is approved. A past time is refused.
              </span>
            </label>
          </div>
        </div>

        {!anyChannelConfirmed() && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-[11px] font-extrabold text-amber-900">No channel can deliver this notification</p>
            <p className="mt-1 text-[11px] leading-4 text-amber-900">
              The backend has not confirmed a delivery provider for any channel, so submission is blocked regardless of
              what is filled in below. This is a contract gap, not a form error — completing the draft will not clear it.
            </p>
          </div>
        )}

        {issues.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] font-extrabold text-amber-900">
              {issues.length} item{issues.length === 1 ? "" : "s"} to complete
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-amber-900">
              {issues.slice(0, 4).map((issue) => (
                <li key={issue.field + issue.message}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={secondary} onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          <PreparedAction contract={contract} reason={submit.reason} disabled={!submit.allowed}>
            <Send size={14} aria-hidden="true" /> Submit for approval
          </PreparedAction>
        </div>
        <InertNote contract={contract} />
      </Card>

      {showPreview && <PreviewCard draft={draft} />}
    </>
  );
}

function PreviewCard({ draft }: { draft: NotificationDraft }) {
  return (
    <Card>
      <SectionHeading
        title="Preview"
        description="How the message is expected to render. Personalisation is shown as its placeholder until the engine fills it."
      />
      <div className="mt-3 space-y-3">
        {draft.channels.length === 0 && (
          <p className="text-xs text-star-muted">Select a channel to preview it.</p>
        )}
        {draft.channels.includes("email") && (
          <div className="rounded-lg border border-[#e7ece7]">
            <div className="flex items-center gap-2 border-b border-[#e7ece7] bg-[#f8faf7] px-3 py-2">
              <Mail size={14} aria-hidden="true" className="text-star-muted" />
              <span className="text-[11px] font-extrabold text-star-900">Email</span>
            </div>
            <div className="p-3">
              <p className="text-xs font-extrabold text-star-900">{draft.title || "(no title)"}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#263b2c]">
                {draft.body || "(no body)"}
              </p>
              {draft.ctaUrl && (
                <p className="mt-2 text-[11px] font-bold text-star-700 underline">{draft.ctaUrl}</p>
              )}
            </div>
          </div>
        )}
        {draft.channels.includes("in-app") && (
          <div className="rounded-lg border border-[#e7ece7]">
            <div className="flex items-center gap-2 border-b border-[#e7ece7] bg-[#f8faf7] px-3 py-2">
              <Bell size={14} aria-hidden="true" className="text-star-muted" />
              <span className="text-[11px] font-extrabold text-star-900">In-app notification</span>
            </div>
            <div className="p-3">
              <p className="text-xs font-extrabold text-star-900">{draft.title || "(no title)"}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#263b2c]">{draft.body || "(no body)"}</p>
            </div>
          </div>
        )}
        <p className="text-[11px] leading-4 text-star-muted">
          Preview only. Rendering in a real mail client can differ, and this preview does not prove delivery.
        </p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TemplatesPanel({ contract }: { contract: ContractState }) {
  const [body, setBody] = useState("Hi {{firstName}}, your investment in {{productName}} is confirmed.");
  const [name, setName] = useState("");
  const issues = validateTemplate(body);
  const used = templatePlaceholders(body);

  return (
    <>
      <Card>
        <SectionHeading
          title="Template editor"
          description="Reusable notification bodies with validated placeholders. A template with an unsupported placeholder is refused, because the investor would see the raw token."
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs font-bold">
              Template name
              <input
                className={input + " mt-1"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="e.g. Investment confirmation"
              />
            </label>
            <label className="block text-xs font-bold">
              Body
              <textarea
                className={input + " mt-1 font-normal"}
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={5000}
              />
            </label>
            {issues.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <ul className="list-inside list-disc space-y-0.5 text-[11px] text-amber-900">
                  {issues.map((i) => (
                    <li key={i.message}>{i.message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="rounded-lg border border-star-200 bg-star-50 p-3 text-[11px] font-bold text-star-700">
                Template is valid. All placeholders are supported.
              </p>
            )}
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-[#e7ece7] p-3">
              <p className="text-[11px] font-extrabold text-star-900">Placeholders used</p>
              {used.length === 0 ? (
                <p className="mt-1 text-[11px] text-star-muted">None. The message will be identical for every recipient.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {used.map((p) => (
                    <code key={p} className="rounded bg-[#f4f8f3] px-1.5 py-0.5 text-[10px] font-bold text-star-700">
                      {"{{"}
                      {p}
                      {"}}"}
                    </code>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-[#e7ece7] p-3">
              <p className="text-[11px] font-extrabold text-star-900">Sample render</p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#263b2c]">
                {body.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, token) => `[${token}]`)}
              </p>
              <p className="mt-2 text-[11px] text-star-muted">
                Placeholders appear in brackets. Real values come from the backend at send time.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <PreparedAction contract={contract} variant="secondary" disabled={issues.length > 0 || name.trim().length < 3}>
            <Plus size={14} aria-hidden="true" /> Save template
          </PreparedAction>
        </div>
        <InertNote contract={contract} />
      </Card>

      <Card>
        <SectionHeading title="Saved templates" description="Templates stored by the backend." />
        <div className="mt-3">
          <DataTable<{ id: string; name: string; updated: string }>
            caption="Saved notification templates"
            columns={[
              { key: "name", header: "Template", render: (r) => <span className="font-bold">{r.name}</span>, sortable: true, sortValue: (r) => r.name },
              { key: "updated", header: "Last updated", render: (r) => r.updated, sortable: true, sortValue: (r) => r.updated },
            ]}
            rows={[]}
            rowKey={(r) => r.id}
            emptyTitle="No templates available"
            emptyDetail="Templates are stored and returned by the backend. This list stays empty until that endpoint is approved — no example templates are shown, because a staff member might mistake one for a real saved template."
          />
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

function AutomatedPanel({ contract }: { contract: ContractState }) {
  const [open, setOpen] = useState<string | null>(null);

  const events = [
    { key: "investment-booked", label: "Investment booked", trigger: "Fires after funding verification and booking complete.", channels: ["Email", "In-app"], state: "Prepared" },
    { key: "funding-received", label: "Funding received", trigger: "Fires when Finance verifies an inbound payment.", channels: ["Email", "In-app"], state: "Prepared" },
    { key: "maturity-approaching", label: "Maturity approaching", trigger: "Fires 30 days before a holding matures.", channels: ["Email"], state: "Prepared" },
    { key: "maturity-settled", label: "Maturity settled", trigger: "Fires only after settlement is confirmed by the backend.", channels: ["Email", "In-app"], state: "Prepared" },
    { key: "kyc-decision", label: "KYC decision recorded", trigger: "Fires on an approve or reject decision, never on submission.", channels: ["Email"], state: "Prepared" },
    { key: "statement-ready", label: "Statement ready", trigger: "Fires when a statement export completes.", channels: ["Email"], state: "Prepared" },
    { key: "password-changed", label: "Password changed", trigger: "Security notice to the investor.", channels: ["Email"], state: "Prepared" },
  ];

  return (
    <Card>
      <SectionHeading
        title="Automated events"
        description="Event-driven notifications. The trigger list is fixed by the backend; a staff member chooses the template and channels, not when the event fires."
      />
      <div className="mt-4 divide-y divide-star-200 rounded-lg border border-[#e7ece7]">
        {events.map((event) => {
          const expanded = open === event.key;
          return (
            <div key={event.key}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : event.key)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-star-50/60"
              >
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-star-900">{event.label}</p>
                  <p className="mt-0.5 text-[11px] text-star-muted">{event.trigger}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {event.channels.map((c) => {
                    const key = c.toLowerCase().replace(/\s+/g, "-") as Channel;
                    const state = CHANNELS.includes(key) ? channelState(key) : "unconfirmed";
                    return (
                      <StatusPill key={c} tone={state === "confirmed" ? "positive" : "caution"}>
                        {c} — {channelStateLabel(state).toLowerCase()}
                      </StatusPill>
                    );
                  })}
                  <StatusPill tone="caution">Not enabled</StatusPill>
                </div>
              </button>
              {expanded && (
                <div className="border-t border-star-200 bg-[#f8faf7] px-3 py-3">
                  <FieldGrid
                    rows={[
                      ["Trigger", event.trigger],
                      ["Channels", event.channels.join(", ")],
                      ["Template", "Not selected — template selection needs the backend"],
                      ["Status", "Prepared, not enabled"],
                    ]}
                  />
                  <div className="mt-3 flex justify-end">
                    <PreparedAction contract={contract} variant="secondary">
                      Configure event
                    </PreparedAction>
                  </div>
                  <InertNote contract={contract} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-star-muted">
        An event is only ever enabled on channels the backend has confirmed. No channel is confirmed yet, so every
        event is disabled — including ones that list only in-app delivery.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function DeliveryTable({
  title,
  description,
  rows,
  contract,
  showRetry = false,
  emptyDetail,
}: {
  title: string;
  description: string;
  rows: Row[];
  contract: ContractState;
  showRetry?: boolean;
  emptyDetail: string;
}) {
  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Notification",
      sortable: true,
      sortValue: (r) => r.title,
      render: (r) => (
        <div>
          <p className="font-bold text-star-900">{r.title}</p>
          <p className="text-[11px] text-star-muted">{r.audience}</p>
        </div>
      ),
    },
    { key: "channel", header: "Channel", render: (r) => r.channel, sortable: true, sortValue: (r) => r.channel },
    {
      key: "state",
      header: "Delivery state",
      render: (r) => (
        <div>
          <StatusPill tone={deliveryTone(r.state)}>{deliveryLabel(r.state)}</StatusPill>
          {r.state === "sent" && (
            <p className="mt-1 text-[10px] leading-3 text-star-muted">
              Not proof of delivery — no receipt received
            </p>
          )}
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.state,
    },
    {
      key: "when",
      header: "Scheduled / sent",
      render: (r) => r.scheduledFor ?? "—",
      sortable: true,
      sortValue: (r) => r.scheduledFor ?? "",
    },
  ];

  if (showRetry) {
    columns.push({
      key: "retry",
      header: "Action",
      render: (r) => (
        <div>
          {r.state === "failed" ? (
            <PreparedAction contract={contract} variant="secondary">
              <RefreshCw size={12} aria-hidden="true" /> Retry
            </PreparedAction>
          ) : (
            <span className="text-[11px] text-star-muted">Not retryable</span>
          )}
          {r.failureReason && (
            <p className="mt-1 max-w-[16rem] text-[10px] leading-3 text-star-muted">{r.failureReason}</p>
          )}
        </div>
      ),
    });
  }

  return (
    <Card>
      <SectionHeading title={title} description={description} />
      <div className="mt-3">
        <DataTable<Row>
          caption={title}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          emptyTitle="Nothing to show"
          emptyDetail={emptyDetail}
        />
      </div>
      {showRetry && (
        <p className="mt-3 rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3 text-[11px] leading-4 text-star-muted">
          Retry is offered only for a failed delivery. A sent-but-unconfirmed notification is not retried, because
          that would deliver it twice.
        </p>
      )}
      <InertNote contract={contract} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ChannelsPanel() {
  const icons: Record<Channel, typeof Bell> = {
    "in-app": Bell,
    email: Mail,
    sms: MessageSquare,
    push: Smartphone,
  };
  const channels = CHANNELS.map((channel) => {
    const availability = channelAvailability(channel);
    const state = availability.state;
    return {
      channel,
      icon: icons[channel],
      confirmed: state === "confirmed",
      label: channelStateLabel(state),
      detail:
        state === "confirmed"
          ? "Confirmed by the backend. Selection is enabled."
          : state === "unsupported"
            ? availability.note
            : "Delivery has not been confirmed by the backend. Not selectable and cannot be used for an automated event.",
    };
  });

  return (
    <Card>
      <SectionHeading
        title="Channel configuration"
        description="What can actually be delivered, according to the backend. No channel is shown as confirmed until an authoritative response says so — an unconfirmed channel stays visible and disabled rather than being hidden."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {channels.map((item) => (
          <div key={item.channel} className={"rounded-lg border p-3 " + (item.confirmed ? "border-[#e7ece7] bg-white" : "border-dashed border-amber-300 bg-amber-50/40")}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <item.icon size={15} aria-hidden="true" className="text-star-muted" />
                <p className="text-xs font-extrabold text-star-900">{channelLabel(item.channel)}</p>
              </div>
              <StatusPill tone={item.confirmed ? "positive" : "caution"}>{item.label}</StatusPill>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-star-muted">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <EvidenceBlock
          title="Provider status"
          contract="not-approved"
          items={[
            { label: "In-app provider", value: "Not confirmed by the backend" },
            { label: "Email provider", value: "Not confirmed by the backend" },
            { label: "SMS provider", value: "Not confirmed by the backend" },
            { label: "Push provider", value: "Not confirmed by the backend" },
            { label: "Delivery receipts", value: "Endpoint not implemented" },
            { label: "GET /notifications/channels", value: "Proposed — not approved" },
          ]}
        />
      </div>
    </Card>
  );
}
