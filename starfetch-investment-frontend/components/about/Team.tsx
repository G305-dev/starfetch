import { PeopleSection, type PeopleProfile } from "./PeopleSection";

const teamMembers: PeopleProfile[] = [
  { name: "Name to be provided", role: "Role to be provided", image: "/images/executive-placeholder.svg", alt: "Neutral Starfetch team member profile placeholder", position: "object-center" },
  { name: "Name to be provided", role: "Role to be provided", image: "/images/executive-placeholder.svg", alt: "Neutral Starfetch team member profile placeholder", position: "object-center" },
  { name: "Name to be provided", role: "Role to be provided", image: "/images/executive-placeholder.svg", alt: "Neutral Starfetch team member profile placeholder", position: "object-center" },
  { name: "Name to be provided", role: "Role to be provided", image: "/images/executive-placeholder.svg", alt: "Neutral Starfetch team member profile placeholder", position: "object-center" },
];

export function Team() {
  return <PeopleSection id="team" eyebrow="Our people" title="Team" description="The people supporting Starfetch Investment Limited. Team profiles and roles will be added as they are provided." people={teamMembers} />;
}
