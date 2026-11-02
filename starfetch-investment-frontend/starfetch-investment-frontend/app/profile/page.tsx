import type { Metadata } from "next";
import { IndividualProfileContent } from "@/components/portal/IndividualProfileContent";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
export const metadata:Metadata={title:"Profile | Starfetch Investor Portal",description:"Manage your individual investor profile."};
export default function ProfilePage(){return <div className="min-h-screen bg-[#fffef9] text-star-900 lg:flex"><PortalSidebar/><div className="min-w-0 flex-1"><PortalHeader/><div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-8 lg:px-8 xl:px-10"><IndividualProfileContent/></div></div></div>}
