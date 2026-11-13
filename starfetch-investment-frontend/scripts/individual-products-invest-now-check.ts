import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ServiceDetail } from "../components/services/services-data";

// Keeps this standalone source check on the project-root compilation path.
type _ServiceDetail = ServiceDetail;

const productsContentSource = readFileSync(join(process.cwd(), "components/portal/ProductsContent.tsx"), "utf8");
const individualProductsPageSource = readFileSync(join(process.cwd(), "app/products/page.tsx"), "utf8");
const jointProductsPageSource = readFileSync(join(process.cwd(), "app/joint/products/page.tsx"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(individualProductsPageSource.includes("<ProductsContent />"), "Individual Products must continue to render the shared products content with its Individual defaults");
assert(productsContentSource.includes("showIndividualInvestNowActions = true"), "Individual Products must enable Invest Now actions by default");
assert(productsContentSource.includes("serviceDetails.map((service) => (") && productsContentSource.includes("showIndividualInvestNowActions ? ("), "Every Individual product card must evaluate the Invest Now action inside the product-card map");
assert(productsContentSource.includes(">\n                        Invest Now\n                      </button>"), "Individual product cards must visibly label the action Invest Now");
assert(productsContentSource.includes("onClick={() => openIndividualInvestmentAction(service)}") && productsContentSource.includes("aria-haspopup=\"dialog\""), "Individual Invest Now actions must open an accessible product-specific notice");
assert(productsContentSource.includes("Online investment actions are unavailable") && productsContentSource.includes("No investment instruction, booking, funding request, enquiry, or personal information will be submitted."), "Invest Now must not represent an unavailable online investment action as executed or submitted");
assert(jointProductsPageSource.includes("showIndividualInvestNowActions={false}"), "The requested Individual Invest Now controls must not change Joint Products behaviour");

console.log("PASS — Every Individual product card exposes a non-transactional Invest Now action while preserving the existing Individual and Joint product safety boundaries");
