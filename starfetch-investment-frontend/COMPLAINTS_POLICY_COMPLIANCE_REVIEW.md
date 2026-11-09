# Complaints Policy implementation — frontend consistency review

**Review scope:** current frontend source only, reviewed 22 October 2026. This is not evidence that a complaints email inbox, operational complaints process, electronic register, management review, SEC notification workflow, or Securities and Exchange Commission reporting process is live. It is also not legal advice or a production infrastructure audit.

**Policy preserved on the new page:** Version `2026-08-11.v1`, effective **11 August 2026**. The policy text was not changed to address the findings below.

## Operational-channel review

| Published channel or operational claim | Current frontend evidence | Finding for Compliance Officer review |
| --- | --- | --- |
| **Contact form** | No public name/email/message contact form is present in the reviewed homepage or shared public components. The visible `MarketDigest` form is a newsletter UI and is local-only; it is not a contact or complaints form. | Section 3 says complaints may be made through this website using the contact form. This channel is not implemented in the current frontend. Do not represent it as available unless an approved, secure implementation and operating process are in place. |
| **“Leave a message” widget** | No widget, third-party chat/embed, iframe, or “Leave a message” implementation was found in the reviewed public frontend source. | Section 3 refers to a “Leave a message” widget on any page. This channel is not implemented in the current frontend. |
| **Complaints email address** | `mailto:info@starfetchinvestltd.com.ng?subject=Complaint` is a working browser mail link. The same displayed email and postal address are present in the shared Footer. | A mailto link proves only that a visitor can open their email client. Frontend source cannot verify mailbox ownership, monitored service levels, acknowledgement handling, delivery, record retention, or the published timelines. Compliance must verify the inbox and operating ownership before release. |
| **Letter and in-person address** | The policy’s street address matches the shared Footer address: The Bloc (2nd Floor), 70 Kusenla Road, Off Lekki–Epe Expressway, Ikate-Elegushi, Lekki, Lagos, Nigeria. | The frontend can confirm the text matches. It cannot verify that the office receives letters/in-person complaints, is staffed during the stated business hours, or has a documented escalation route. |
| **Acknowledgement and resolution timings** | The new page accurately displays the 2-working-day email/website acknowledgement, 5-working-day postal acknowledgement, 10-working-day target response, and 2-working-day SEC-notification wording. No complaint form, API, timer, acknowledgement generator, or tracking record was created. | The policy’s response times must be supported by an approved operating procedure; the webpage must not be taken as evidence that this is automated or currently operational. |
| **Electronic complaints register, management review and SEC returns** | No frontend complaints register, API, Admin Portal feature, database change, or reporting workflow was added or inspected. | Section 7’s register and returns claim, and Section 9’s Board-reporting claim, require business/Compliance verification outside this frontend scope. |
| **Privacy Policy link** | Section 8 uses an internal Next.js `Link` to `/privacy`. | Implemented and verified locally; it no longer directs a visitor to the legacy Starfetch domain. |
| **SEC escalation website** | Section 6 uses the supplied external link `https://sec.gov.ng/`. | The link is rendered as an external destination. Its availability/content must be verified by Compliance at release time. |

## Implementation decision

- The supplied legal and regulatory wording is reproduced faithfully on `/complaints`; no unsupported complaint submission, acknowledgement, record, API, or notification was added.
- No policy wording, version, effective date, backend source, API contract, database, authentication behaviour, Individual/Joint/Corporate feature, or Admin Portal was changed.
- The Footer now points to `/privacy` and `/complaints` with local Next.js navigation.

## Required Compliance Officer approval before production release

1. Confirm whether a public contact form and “Leave a message” widget should exist, or provide formally approved replacement policy wording.
2. Verify that `info@starfetchinvestltd.com.ng` is a monitored complaints channel with ownership, staffing, mailbox security, retention, and documented response procedures that support the published timescales.
3. Verify the postal/in-person complaint channels and the stated Monday–Friday 8:30am–5:30pm WAT availability.
4. Confirm the operational electronic register, management review, SEC notification, periodic return, escalation, confidentiality, and Board-reporting procedures described in the policy.
5. Perform a deployed-site review before release; frontend source cannot establish live email delivery, external link availability, server-side forms, redirects, or operational regulatory compliance.
