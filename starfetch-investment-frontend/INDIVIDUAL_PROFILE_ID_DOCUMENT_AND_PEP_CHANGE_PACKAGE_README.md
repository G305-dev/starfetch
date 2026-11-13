# Individual Profile ID Document and PEP — Change Package

This package contains the frontend changes from the latest Individual Profile request.

## Included changes

1. **Gender selection**
   - Replaces the free-text Gender input with a dropdown containing Male and Female.

2. **Conditional ID document control**
   - Shows an ID document file-selection control after the user selects Passport, PVC, Driver’s License, or NIN.
   - Requires a document file selection before the Personal Information section can be completed.
   - Keeps the file in the browser control for the current page only; it is not uploaded, transmitted, or stored by the portal.

3. **PEP labels and copy**
   - Changes the PEP radio labels from “Applicant — Yes/No” to “Yes/No”.
   - Removes the requested PEP declaration explanatory paragraph.

4. **Regression checks**
   - Updates the Individual local-KYC and PEP source-level checks for the revised requirements.

## Validation completed

- TypeScript typecheck passed.
- Individual sequential progression, local KYC, PEP, investment-risk, Bank Details, and Source of Funds checks passed.
- Production build passed with 43 static routes generated.

## Boundary retained

The ID document control is frontend-only. No file contents, KYC values, PEP declaration, or other local draft data are sent to backend services, browser persistence, logging, or storage.
