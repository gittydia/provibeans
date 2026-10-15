/**
 * Feature visibility, governed by the Chapter I scope.
 *
 * `project-plan.md` states the system "will not perform ... online payment
 * processing, or end-to-end e-commerce unless these are later approved as
 * extensions" (Scope and Limitations), and lists "customer ordering" under
 * Future Work rather than present scope.
 *
 * The cart and its checkout are therefore built but switched OFF: no nav entry,
 * no add-to-cart control, and `/cart` returns 404. The code stays in the tree so
 * the feature can be re-enabled by changing one value, and so its suites remain
 * runnable, rather than being deleted and having to be rebuilt.
 *
 * Set NEXT_PUBLIC_COMMERCE=1 (or edit the constant below) to restore it.
 */
export const COMMERCE_ENABLED = process.env.NEXT_PUBLIC_COMMERCE === "1";

/**
 * Customer ordering is NOT behind a flag — the public `/order` route was deleted
 * outright, along with the enquiry form. Neither had any basis in the plan:
 * "customer ordering" is named under Future Work, and the words enquiry, contact,
 * message and email do not appear in it at all.
 *
 * What survives is inventory work, not commerce. `lib/inventory/orders.ts`, the
 * `order_requests` / `order_request_lines` / `order_reservations` tables and the
 * staff view at `/requests` all remain live, because holding and allocating stock
 * is squarely Chapter I. With commerce enabled the cart checkout still reaches that
 * engine; there is no separate public ordering form to resurrect.
 */
