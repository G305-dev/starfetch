Starfetch About Us — Board section removal only

This patch contains only the About Us Board-section removal and its regression check. Extract the files into the root of the existing starfetch-investment-frontend project, preserving their paths.

The About page no longer imports or renders StarfetchBoard. The Board component and data are retained. No KYC prompt files, API client files, or backend files are included. This archive does not fix the separate Vercel KYC import error.

Verified: npm run test:about-profile-cards
