Starfetch frontend updates — source patch

This archive contains only the files changed for the two requested updates. It is not a full repository archive. Extract these paths into the root of the existing starfetch-investment-frontend project, preserving the directory structure.

Included updates:
1. Individual dashboard KYC reminder: visibility is read from the authenticated backend Individual KYC profile and the modal appears only while status is DRAFT. Non-DRAFT statuses (including SUBMITTED and UNDER_REVIEW) hide it. No browser storage is used; “Maybe later” remains temporary. The current Corporate reminder behavior is unchanged because Corporate Profile submission is not an enabled backend workflow.
2. About Us: the Board of Directors section is no longer rendered on /about. The StarfetchBoard component/data are retained; only the About page import and render were removed.

Checks passed from the project root:
- npm run test:kyc-dashboard-prompt
- npm run test:about-profile-cards
- npm run typecheck
- npm run build

No backend files are included or modified by this patch.
