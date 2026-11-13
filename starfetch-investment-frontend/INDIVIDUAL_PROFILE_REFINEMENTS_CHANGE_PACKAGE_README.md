# Individual Profile Refinements — Change Package

This package contains the frontend changes from the latest Individual Profile request.

## Included changes

1. **Account-managed names**
   - First name and last name are read-only in the Individual Profile.
   - Phone number remains the only editable supported profile contact field.

2. **Investment horizon**
   - Removes the “< 1 year” option.
   - Adds “180 days” and “365 days”.

3. **Bank Details copy removal**
   - Removes the requested settlement-account/third-party-payment wording.
   - Removes the requested local-draft/BVN explanatory paragraph.

4. **Source of Funds copy removal**
   - Removes the requested explanatory paragraph from the Source of Funds and Wealth section.

5. **PEP placement**
   - Places the PEP Declaration inside Personal Information.

6. **Regression checks**
   - Updates the Individual Profile, investment horizon, Bank Details, Source of Funds, and PEP source-level checks for the revised requirements.

## Validation completed

- TypeScript typecheck passed.
- All five relevant Individual Profile source-level checks passed.
- Production build passed with 43 static routes generated.

## Boundary retained

The individual local KYC, investment-risk, Bank Details, PEP, and Source of Funds drafts remain current-page-only frontend state. This package contains no backend changes, deployment, or submission workflow.
