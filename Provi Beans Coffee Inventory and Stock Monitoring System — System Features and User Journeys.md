# Provi Beans Coffee Inventory and Stock Monitoring System

## System Features and User Journeys

# Purpose

This document describes the implemented features and user journeys for the Provi Beans capstone. The system supports a specialty coffee business that sources beans from Vietnam and sells them to coffee shop enthusiasts and coffee shop owners in the Philippines.  
The system focuses on inventory operations. It records products, suppliers, deliveries, batches, stock changes, freshness dates, alerts, and reports. It is a frontend-only demonstration: it uses bundled mock data and browser-local state, with no database, backend API, server-side authentication, or external service integration.  
The system does not need a Vietnam shipping reference. A delivery can carry a supplier document number or another unique free-text reference.

# 1\. System Users and Access

* Administrator — manages accounts, roles, product and supplier records, and deliveries, and reviews reports and activity.  
* Inventory Staff — receives batches, issues stock, records stock changes, quarantines or releases batches, and responds to alerts.  
* Owner or Manager — monitors inventory health, reviews reports and activity, with read-only access to records, accounts, and stock screens.  

Inventory staff handle daily stock operations. Administrators maintain records and accounts and perform stock operations; owners/managers review performance without changing data. The demonstration does not include an approval hierarchy, a separate receiving clerk, or a system administrator distinct from the administrator role.

# 2\. Core Features

## 2.1 Authentication and Role-Based Access

* Demo sign-in and sign-out with browser-local state.  
* Three roles: Administrator, Inventory Staff, and Owner or Manager.  
* Only an Administrator can manage products, suppliers, deliveries, and accounts. Inventory Staff can receive batches, issue stock, record stock changes, and quarantine or release batches. The Owner/Manager keeps every screen, including reports and the account list, but changes nothing. Master data and stock forms are read-only for the Owner/Manager, and master data is read-only for Inventory Staff.  
* Account creation with name, email, role, and an optional password. A blank password uses the demo password. Accounts can be activated or deactivated, and deactivated accounts cannot sign in.  
* There is no password reset, server-side session control, or multi-user synchronization in the demonstration.  
* Accounts is visible to Administrator and Owner/Manager; only an Administrator can add or deactivate accounts or restore a backup, while the Owner/Manager reads the list. Reports & activity appears in their navigation, and CSV export is limited to them. Stock-changing operations are limited to Administrator and Inventory Staff.  
* Role checks are UI behavior, not a server-side security boundary.  

## 2.2 Product and Supplier Records

* Product records store SKU, name, origin country and region, species or blend, process, roast level, weight in grams, unit price, low-stock level, reorder point, near-expiry days, and active or inactive status.  
* SKUs are normalized to uppercase and checked for duplicates before a product is saved.  
* Product records do not have separate bean-form, unit-of-measure, preferred-stock, or storage fields. Weight is product information, and stock is tracked in whole units.  
* Supplier profiles store name, contact person, email, phone, country, address, and notes. Supplier names must be unique.  
* Supplier records do not have a separate status field; product records carry the active or inactive state.  

## 2.3 Supplier Delivery and Batch Receiving

* Delivery records store supplier, optional reference, received date, and notes. The reference is free text and must be unique when provided; it is normally a supplier document number. It is not an internal receiving ID, customs record, freight tracker, or Vietnam shipping reference.  
* Batch receiving is part of stock-in. When a shipment arrives, staff choose a product, batch code, quantity, received date, and optional delivery; they can also enter roast, pack, best-before, and expiry dates, plus notes.  
* A partial receipt is recorded by receiving the actual quantity and noting the shortage. The demonstration does not store expected quantity, shortage quantity, supplier rating, receiving staff, or line items on a delivery.  
* Damage or quarantine discovered after receipt is handled through Stock changes or the Quarantine tab, not through delivery fields.  
* Receiving validates that a product is selected, the batch code is present and unique, and the quantity is a positive whole number. It does not reconcile received quantity against an expected delivery quantity.  

## 2.4 Batch Management and Stock Status

* Each batch has a unique batch code across all stock, a product, an optional supplier delivery, a received date, freshness dates, a status, and notes.  
* A batch is created as Active and can be placed into Quarantine or released. The model also defines Depleted and Disposed statuses, but no screen currently applies them. The interface shows Expired, Quarantine, Near expiry, and Ready to issue badges derived from dates and status.  
* The batch table shows batch code, product SKU and name, use-by date, days to expiry, in-stock quantity, reserved quantity, available quantity, and a state badge. It does not show the raw status value or quarantine reason; the reason appears on the Quarantine tab.  
* Batch activity is represented by stock changes: receipts, issues, reservations, releases, cancellations, returns, damage, disposal, physical-count adjustments, quarantine, release from quarantine, and reversals. A generic adjustment type exists in the data model but is not offered in the stock-change form.  
* Batch-code uniqueness is global, not limited to a product or delivery.  
* The demonstration does not have a separate storage-status field such as ambient, chilled, or frozen.  

## 2.5 Stock-In, Stock-Out, Reservations, and Quarantine

* Stock-in records a receipt for a batch. It does not create or edit a delivery record.  
* Stock-out records an issue against a product and batch. The system blocks an issue that exceeds the batch’s available quantity.  
* Reservations, releases, and cancellations track held stock. The demonstration has no order records; reservations can represent holds for pending sales or allocations.  
* Returns add stock back to the selected batch. Damage and disposal reduce stock only when they do not exceed unreserved stock.  
* Physical-count variances add stock. The stock-change form does not offer a generic adjustment type; use physical count for an upward correction, or damage, disposal, or a reversal when stock is lower.  
* Quarantine requires a reason. Other stock changes can include a reason and reference, but a reason is not required for every change.  
* Reversals append an opposite stock movement instead of deleting or editing history. A stock change can be reversed once. The original movement remains in the activity log.  
* Posted stock changes are not edited or deleted.  

## 2.6 Stock Monitoring and Availability

* The dashboard shows inventory value, available units, reserved units, and open alerts as its headline totals. It also shows low-stock or reorder products, expiring batches, expired or quarantined batches, and the latest 12 stock changes.  
* The product table shows stock on hand, reserved quantity, and available quantity. Available quantity excludes reserved, quarantined, damaged, disposed, and expired units.  
* The All batches table shows the same balance at batch level.  
* The Quarantine tab lists quarantined batches and provides release or quarantine controls. Quarantined stock stays on the books and is excluded from issue availability; the stock-change form still lists held batches, so a reservation is not blocked by batch state.  
* Damaged and disposed quantities are reflected in on-hand balances and stock history rather than separate stock buckets.  
* Quantities are whole units. Weight is recorded on the product, but the demonstration does not convert bags to kilograms or track unit conversions.  

## 2.7 Expiry Dates, Freshness, and Earliest-Expiry Priority

* A batch can carry roast date, pack date, best-before date, and expiry date. A best-before date is used as a freshness date even when no expiry date is entered.  
* If an expiry date is entered, receiving rejects an expiry earlier than the entered roast, pack, or best-before date. The received date is not checked against expiry.  
* Near-expiry alerts use the product’s near-expiry days and exclude batches that have already expired.  
* When issuing without a selected batch, the system suggests the active, unexpired batch with the earliest use-by date; it uses expiry, then best-before, then received date as available. The user can still choose a specific batch.  
* If a user chooses a newer batch instead of the suggested one, the demonstration does not display a warning or require a reason.  
* If a specific batch is selected, issuing uses only that batch rather than combining stock across batches.  

## 2.8 Alerts, Dashboard, Filtering, and Reports

* Alerts cover low stock, reorder point, expired stock, quarantined stock, and near-expiry stock. There are no damage or count-variance alert types.  
* The dashboard uses operational exception panels first, followed by stock and recent activity.  
* Stock changes can be filtered by change type and date range, and the table is capped at 200 rows. The UNQUARANTINE change is not available as a filter.  
* Periodic reports support weekly, monthly, and yearly views using UTC period boundaries. The demonstration does not have a period-close workflow.  
* Reports & activity has four tabs: Stock by batch, Stock changes, Activity, and Periodic reports. It does not have separate supplier-delivery, low-stock, expiring, physical-count, adjustment, or batch-traceability reports.  
* CSV export is available for Stock changes and Periodic reports. There is no print view.  
* There is no global search or barcode lookup.  
* The Activity tab shows recent stock movements, product activation or deactivation, and account creation or deactivation. It does not log every record creation, every edit, or every approval.  

## 2.9 Accuracy, Error Prevention, and Audit Trail

* Issue quantity cannot exceed available stock for the selected batch. Damage and disposal cannot exceed unreserved stock. Release and cancel cannot exceed reserved stock.  
* Expired and quarantined batches are excluded from issue availability. A quarantined batch can be released, but an expired batch remains non-issuable after release.  
* Reversals append opposite movements and preserve the original record. The system does not silently delete or overwrite posted stock history.  
* The Activity tab and activity report preserve stock-related actions for later review.  
* The demonstration does not have a duplicate-submit guard; repeated submissions can create repeated records. It also does not detect conflicts between multiple browser sessions.  
* There is no approval workflow, period lock, or separation of duties.  

# 3\. Business Rules

* Only active products can be selected for new batches. Product records can be deactivated without deleting their history.  
* Products carry a low-stock level, a reorder point, and a near-expiry threshold.  
* Supplier names are unique. Delivery references are unique when provided.  
* Batch codes are unique across all stock.  
* Receiving rejects zero or negative quantities and requires whole units.  
* Expiry cannot precede the entered roast, pack, or best-before date.  
* Expired, quarantined, damaged, and disposed stock cannot be issued. In this implementation, damage and disposal reduce on-hand stock rather than assigning a separate batch status.  
* Stock-out cannot exceed available stock. A selected batch is not combined with other batches.  
* Physical-count changes can only add stock. A lower physical count must be recorded as damage, disposal, or a reversal of an earlier movement.  
* Reversals and physical-count changes preserve history and do not delete stock movements.  
* Delivery references are free text and are not validated against customs, freight, or Vietnam shipping documents.  
* The demonstration does not include purchase-order creation, automatic replenishment, barcode scanning, email or SMS delivery, or external service integration.  

# 4\. User Journeys

## Journey A — Administrator Sets Up Products, Suppliers, and Accounts

1. Sign in as an administrator.  
2. Open Accounts and create user accounts with a name, email, role, and optional password.  
3. Open Products & suppliers > Products and add a product: SKU, name, weight, price, origin, species or blend, process, roast level, low-stock level, reorder point, and near-expiry days.  
4. Open Suppliers and add a supplier profile with contact details.  
5. Optionally open Deliveries and record a supplier document number, received date, and notes.  
6. Use the product state control to deactivate or reactivate a product instead of deleting it.  
Expected result: Products, suppliers, deliveries, and accounts are ready for stock operations. The administrator can manage master data and review activity.  

## Journey B — Inventory Staff Receives a New Batch

1. Sign in as inventory staff, administrator, or owner/manager.  
2. Open Batches & receiving > Receive.  
3. If a supplier document should be tracked, first record it under Products & suppliers > Deliveries.  
4. Choose the product, enter a unique batch code and whole quantity, and confirm the received date.  
5. Optionally link the supplier delivery and enter roast, pack, best-before, and expiry dates plus notes.  
6. Submit the form. The system validates the product, batch code, quantity, and date relationship; it creates a receipt movement and an active batch.  
7. For a partial delivery, receive the actual quantity and note the shortage. For damage or a hold, use Stock changes or Quarantine after receipt.  
Expected result: The batch is recorded with its stock-in movement, optional delivery link, and freshness dates. No delivery-level expected-quantity or shortage fields are required.  

## Journey C — Inventory Staff Issues Stock Using Earliest-Expiry Priority

1. Open Issue & stock changes > Issue stock.  
2. Choose the product and enter a whole quantity.  
3. Optionally choose a batch, reference, and reason.  
4. Leave the batch blank to use the suggested earliest-expiry batch, or select a specific batch.  
5. Submit. The system blocks the issue if the quantity exceeds available stock, and it uses only the selected batch when one is chosen.  
6. Review the updated batch balance and the new stock change in Activity.  
Expected result: The issue is recorded against valid stock. With a blank batch, the earliest-expiry suggestion is used; the user is not warned when a newer batch is deliberately selected.  

## Journey D — Inventory Staff Records a Stock Change or Physical Count

1. Open Issue & stock changes > Stock changes.  
2. Select a batch and a change type: reserve, release, cancel, return, damage, dispose, or physical count. The form does not offer a generic adjustment type.  
3. Enter a positive whole quantity. Add a reason or reference where needed.  
4. Submit. The system checks release and cancel against reserved stock, and damage and disposal against unreserved stock.  
5. For a physical count, enter the quantity added. If the physical count is lower, record damage or disposal, or reverse an earlier movement.  
6. Use the stock history to review the change. A posted change can be reversed, but it cannot be edited or deleted.  
Expected result: The stock change is recorded with its reason where provided, and the batch balance is updated. The demonstration does not create a separate count session or require approval for stock changes.  

## Journey E — Manager Monitors Inventory Health and Reviews Reports

1. Sign in as an administrator, inventory staff member, or owner/manager.  
2. Open the dashboard to review inventory value, available units, reserved units, and open alerts.  
3. Review low-stock or reorder products, expiring batches, expired or quarantined batches, and recent stock changes.  
4. Follow an alert to the relevant product or batch screen to prioritize replenishment, issuing, release, or disposal.  
5. Open Reports & activity to review Stock by batch, Stock changes, Activity, and Periodic reports.  
6. Filter Stock changes by type or date, and export Stock changes or Periodic reports as CSV.  
Expected result: The manager can identify stock risks and review history. The demonstration does not generate purchase orders, approve stock changes, or close reporting periods.  

## Journey F — Manager Reviews a Batch and Its Stock History

1. Open Batches & receiving > All batches.  
2. Locate the batch in the batch table and review its product, use-by date, days to expiry, in-stock, reserved, available, and state badge. The table does not show the quarantine reason.  
3. Open Reports & activity > Stock changes to review movements, using type and date filters where useful.  
4. Open Reports & activity > Stock by batch for a balance-focused view, or Activity for account and product state changes.  
5. Open Quarantine to inspect a held batch's reason, release it, or place another batch on hold when needed.  
Expected result: The user can review summary batch information and stock history. The demonstration does not provide a dedicated single-batch traceability view or a drill-down from a batch to its optional delivery link.  

# 5\. Input, Validation, and Error Handling

* Product SKU and name are required; SKU is normalized to uppercase and must be unique.  
* Supplier name is required and must be unique.  
* Delivery supplier is required; reference is optional but must be unique when provided.  
* Batch product, batch code, and quantity are required. Quantity must be a positive whole number, and batch code must be unique across all stock.  
* Expiry must not be earlier than entered roast, pack, or best-before dates.  
* Issue requires a product and positive whole quantity; the selected batch must have enough available stock.  
* Stock changes require a batch and positive whole quantity. Quarantine requires a reason.  
* Invalid submissions return field-level messages without creating a stock movement.  
* Successful actions show a success message; invalid actions show an error and, where applicable, field-level messages. Forms do not have a separate warning state. Operators review validation messages and correct the form before retrying.  

# 6\. Scope and Limitations

The Provi Beans system is a frontend-only demonstration of inventory monitoring and stock control. It uses bundled mock data and browser-local state. Items and movements entered in one browser session are not synchronized to another browser or device, and they are not stored in a database or processed by a backend API.  
The system does not include a database, backend API, server-side authentication, external service integration, barcode scanning, global search, print view, purchase-order entity, automatic replenishment, period close, approval workflow, or multi-user conflict handling.  
The system supports the core inventory workflow: maintain products and suppliers, record deliveries and batches, receive and issue stock, reserve and release stock, quarantine stock, record damage and disposal, record physical counts, review alerts and reports, and export stock reports.  
The system is not a full enterprise resource planning platform. It is an academic prototype that demonstrates role-aware inventory operations with auditable stock history in a browser-local environment.  

# 7\. Defense Flow

1. Open with the business problem: Provi Beans needs a clear view of batch-level stock, freshness, reservations, and stock movements without relying on spreadsheets.  
2. Show the roles: Administrator manages accounts and master data and performs stock operations; Inventory Staff handles receiving, issuing, and stock changes; Owner/Manager reviews inventory health, reports, and the account list read-only.  
3. Demonstrate product and supplier setup, then record a delivery and receive a batch.  
4. Issue stock without choosing a batch to show earliest-expiry priority, then show how a specific batch can be selected.  
5. Record a reservation, release, quarantine, damage, disposal, physical count, and reversal to show stock history and balance changes.  
6. Show low-stock, reorder, near-expiry, expired, and quarantine alerts on the dashboard.  
7. Open Reports & activity to show Stock by batch, Stock changes, Activity, and Periodic reports, then export a CSV.  
8. Explain the boundaries: the demonstration is frontend-only, has no database or backend, has no approval workflow, does not support global search or print, and does not record every possible audit event.  
9. Close with the value delivered: batch-level visibility, controlled stock movements, freshness monitoring, role-aware access, and reviewable stock history.  
