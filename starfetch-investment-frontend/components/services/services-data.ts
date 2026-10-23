export type ServiceDetail = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  supportingDescription: string;
  howItWorks: string[];
  typicalUse: string;
  riskCharacter: string;
  image: string;
  imageAlt: string;
  reverseLayout?: boolean;
  tone?: "white" | "cream";
};

export const serviceDetails: ServiceDetail[] = [
  {
    id: "fixed-note",
    eyebrow: "01 — Fixed income",
    title: "Starfetch Fixed Note",
    description: "A structured fixed-income solution designed for investors seeking capital preservation, stable income and predictable investment outcomes.",
    supportingDescription: "The portfolio may include Nigerian money-market and fixed-income instruments such as treasury bills, government bonds, bank placements and carefully selected corporate debt instruments, subject to the approved investment mandate.",
    howItWorks: [
      "You invest funds for an agreed investment period under clearly disclosed terms. The applicable rate, tenor and relevant conditions are communicated before you commit. At maturity, available options may include redemption, rollover or additional investment, subject to the product terms.",
    ],
    typicalUse: "Capital preservation, short- to medium-term financial goals, treasury management and income-focused investment objectives.",
    riskCharacter: "Conservative relative to higher-risk market strategies, with emphasis on credit quality, liquidity and duration management. Investment returns are not guaranteed.",
    image: "/images/solution-fixed-note.png",
    imageAlt: "Stacks of Nigerian one-thousand-naira banknotes arranged on a white background",
    tone: "white",
  },
  {
    id: "discretionary-portfolios",
    eyebrow: "02 — Managed portfolios",
    title: "Starfetch Discretionary Portfolios",
    description: "Professionally managed investment portfolios designed around each client's financial objectives, risk tolerance and investment horizon.",
    supportingDescription: "Under a discretionary mandate, Starfetch manages the portfolio within agreed investment guidelines, allowing investment decisions to be implemented efficiently while remaining aligned with the client's documented objectives.",
    howItWorks: [
      "We begin by understanding the client's goals, investment horizon and risk profile. A suitable investment mandate is then established, defining asset allocation, investment limits and risk parameters.",
      "Starfetch manages and monitors the portfolio within those agreed guidelines, making investment decisions on the client's behalf while providing regular reporting and portfolio updates.",
    ],
    typicalUse: "Long-term wealth management, family portfolios, institutional mandates and investors who want professional portfolio management without making every individual investment decision themselves.",
    riskCharacter: "Risk varies according to the client's agreed investment mandate, asset allocation and risk profile. Diversification and ongoing monitoring are used to manage portfolio risk, but investment values may rise or fall and returns are not guaranteed.",
    image: "/images/solution-discretionary-portfolios.png",
    imageAlt: "Business professionals shaking hands over a financial growth chart",
    reverseLayout: true,
    tone: "cream",
  },
  {
    id: "execution-mandate",
    eyebrow: "03 — Market execution",
    title: "Starfetch Execution Mandate",
    description: "A professional execution service for clients who require efficient access to capital markets while retaining control over their own investment decisions.",
    supportingDescription: "Under an execution mandate, the client determines the investment decision while Starfetch provides professional support for implementing approved transactions within the agreed mandate and applicable regulatory framework.",
    howItWorks: [
      "The client determines the investment opportunity and provides the relevant instruction. Starfetch facilitates execution according to the agreed mandate, supports the operational process and provides confirmation and reporting on completed transactions.",
      "The investment decision remains with the client, while Starfetch provides professional execution support and market access.",
    ],
    typicalUse: "Experienced investors, corporate clients, institutions and other clients who make their own investment decisions but require professional execution and operational support.",
    riskCharacter: "Risk depends on the instruments selected by the client. Execution support does not remove market, liquidity, credit or other risks associated with the underlying investment.",
    image: "/images/solution-execution-mandate.webp",
    imageAlt: "Professionals reviewing transaction paperwork together before an investment decision",
    tone: "white",
  },
];
