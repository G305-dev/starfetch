import { CorporateSidebar } from "@/components/corporate/CorporateSidebar";
import { CorporateTopbar } from "@/components/corporate/CorporateTopbar";
import { CorporateTransactionsContent } from "@/components/corporate/CorporateTransactionsContent";
export const metadata={title:"Transactions | Starfetch Investor Portal",description:"Track corporate portfolio transactions."};
export default function CorporateTransactionsPage(){return <div className="min-h-screen bg-[#f7faf7] lg:flex"><CorporateSidebar/><div className="min-w-0 flex-1"><CorporateTopbar sectionLabel="Transactions"/><div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7"><CorporateTransactionsContent/></div></div></div>}
