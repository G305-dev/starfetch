# Recent Frontend Change Package — Products to KYC Handoff

## Package scope

This package starts with the requested removal of the following notice from the **Joint Products** experience:

> “Products are informational. Online investment execution, funding, bookings, and enquiry submission are not available in this portal.”

It continues through the most recent **KYC Dashboard Prompt backend handoff report** prepared for Segun.

## Included frontend work

1. **Joint Products notice isolation**
   - Removes the availability notice for Joint Products only.
   - Leaves Individual and Corporate product safety behavior intact.

2. **Individual Products — Invest Now controls**
   - Adds an Invest Now control to every Individual product card.
   - Preserves the non-transactional boundary: no investment instruction, booking, funding request, enquiry, or personal information is submitted.
   - Does not add this Individual-only control to Joint Products.

3. **Individual dashboard layout**
   - Moves Quick Links above Asset Allocation in the Individual dashboard right-side column.

4. **Individual Profile local-only drafts**
   - Adds approved current-page-only local drafts for personal KYC information, Investment Objective and Risk Profile, Bank Details, PEP Declaration, and Source of Funds and Wealth.
   - Includes the supporting regression checks.
   - These fields are not persisted, transmitted, assessed, screened, verified, logged, or retained by the frontend.

5. **Corporate navigation**
   - Removes the Corporate Settings navigation tab while retaining the direct route.
   - Replaces the Corporate Documents navigation tab with Products, linking to `/corporate/products`.
   - Retains the direct Corporate Documents route.

6. **KYC dashboard completion prompt and backend handoff**
   - Includes the Individual and Corporate dashboard prompt component/integration/check.
   - Includes the backend handoff report specifying the required authoritative backend KYC-completion signal and Individual/Corporate flow.

## Package boundaries

- This is a frontend change package only.
- No backend implementation, deployment, Git push/merge, Gmail action, or live investment/KYC submission is included.
- Corporate authentication remains through the existing shared `INVESTOR` sign-in flow; RC Number is not a login credential.

## Validation status

The contained features were validated in their respective completed tasks with TypeScript checks, targeted source-level checks, and production builds where applicable.
