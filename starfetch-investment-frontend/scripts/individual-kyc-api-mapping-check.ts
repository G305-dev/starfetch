import {
  investmentHorizonToWire,
  investmentKnowledgeToWire,
  investmentObjectiveToWire,
  labelToWire,
  minorUnitsToNaira,
  nairaToMinorUnits,
  riskToleranceToWire,
  sourceLabelsToWire,
  sourceOfFundsToWire,
  sourceWireToLabels,
  wireToLabel,
} from "../lib/individual-kyc-mapping";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(labelToWire(investmentObjectiveToWire, "Capital preservation") === "CAPITAL_PRESERVATION", "Objective must use its canonical ID");
assert(labelToWire(riskToleranceToWire, "Aggressive") === "AGGRESSIVE", "Risk tolerance must use its canonical ID");
assert(labelToWire(investmentHorizonToWire, "180 days") === "DAYS_180", "180-day horizon must use DAYS_180");
assert(labelToWire(investmentHorizonToWire, "365 days") === "DAYS_365", "365-day horizon must use DAYS_365");
assert(labelToWire(investmentKnowledgeToWire, "Extensive") === "EXTENSIVE", "Knowledge must use its canonical ID");
assert(sourceLabelsToWire(["Salary / employment", "Other (specify)"])?.join(",") === "SALARY_EMPLOYMENT,OTHER", "Sources must map to canonical IDs in UI order");
assert(sourceWireToLabels(["BUSINESS_INCOME", "OTHER"]).join(",") === "Business income,Other (specify)", "Saved source IDs must hydrate to UI labels");
assert(wireToLabel(investmentHorizonToWire, "YEARS_5_PLUS") === "5 years +", "Saved horizon IDs must hydrate to labels");
assert(labelToWire(investmentObjectiveToWire, "unrecognised") === null, "Unknown controlled labels must not be silently mapped");

for (const [naira, minor] of [["0", "0"], ["1", "100"], ["12.3", "1230"], ["₦ 1,234.56", "123456"], ["0002.05", "205"]] as const) {
  assert(nairaToMinorUnits(naira) === minor, `${naira} should convert exactly to ${minor} minor units`);
}
for (const invalid of ["", "1.234", "-1", "1,2", "abc", "1."]) {
  assert(nairaToMinorUnits(invalid) === null, `${invalid} should be rejected as an invalid naira amount`);
}
assert(minorUnitsToNaira("123456") === "1234.56", "Minor units must rehydrate as precise Naira text");
assert(minorUnitsToNaira("123000") === "1230", "Whole Naira values should not gain unnecessary decimal zeros");
assert(minorUnitsToNaira("invalid") === "", "Malformed saved amounts must not be rendered as valid data");

console.log("PASS — canonical option mapping and exact naira/kobo conversions match the supplied Individual KYC field guide");
