# **CHAPTER I** 

## **INTRODUCTION** 

### **Introduction** 

Coffee is both an agricultural product and a differentiated consumer good whose value depends on origin, variety, processing, roast profile, freshness, and consistent handling. In the Philippine market, specialty coffee appeals to consumers who evaluate quality and product attributes beyond price. Research on local specialty coffee indicates that the market is emerging and that surveyed consumers are willing to pay higher prices for specialty coffee (Laurico et al., 2021). This demand creates an opportunity for distributors that can communicate product information clearly and maintain dependable availability. 

Provi Beans is a specialty coffee business that sources coffee beans from Vietnam and distributes them in the Philippines to coffee shop owners and coffee enthusiasts. Vietnam remains a major coffee-producing and exporting country, while recent trade reporting identifies the Philippines among Asian markets with increasing demand for Vietnamese coffee products (Nguyen, 2024). Because Provi Beans handles products that may differ by origin, variety, processing method, roast or packing date, package size, supplier delivery, and lot, the business requires more than a simple product count. It needs a reliable record of what was received, where each lot came from, how much remains, which units should be issued first, and which products are approaching or have passed their usable dates. 

Inventory errors can affect product availability, cash flow, customer confidence, and product quality. Manual notebooks or disconnected spreadsheets may permit duplicate entries, inconsistent product names, delayed updates, and stock balances that do not match the physical inventory. They can also make it difficult to distinguish lots of the same coffee, trace returned packages, isolate damaged stock, or prevent expired items from being issued. Recent studies of web-based inventory systems report that centralized records, stock thresholds, alerts, and reporting can improve access to timely and accurate inventory information (Kusuma et al., 2023; Oyekan et al., 2024). 

Within the recent literature reviewed, Philippine specialty-coffee demand, general inventory-system development, and coffee traceability are usually examined as separate concerns (Laurico et al., 2021; Kusuma et al., 2023; Tadesse et al., 2024). None of the reviewed studies 

presents a small-business system tailored to a Philippine distributor of Vietnamese specialty coffee that combines detailed product information, supplier delivery records, lot-level dates, FEFO issuance, low-stock and expiration alerts, quarantine statuses, and auditable inventory movements. This absence constitutes the research and practical gap addressed by the study. 

To address this gap, the study proposes the Provi Beans Coffee Inventory and Stock Monitoring System. The system will centralize product, supplier, delivery, lot, and transaction records; monitor available, reserved, damaged, returned, quarantined, and expired quantities; apply First-Expired, First-Out (FEFO) recommendations; and generate alerts and reports for management. The study will connect the business problem, objectives, related literature, requirements, design, development process, testing, and evaluation so that each part of the capstone supports the same operational goals. 

### **Project Background and Context** 

Provi Beans obtains specialty coffee beans from Vietnamese suppliers. Each product may carry attributes that influence purchasing and handling decisions, including country or region of origin, producer or supplier, coffee species or variety, processing method, roast level, flavor notes, package weight, and price. Operationally, the business must also manage supplier delivery details, receiving dates, lot codes, roast or packing dates, best-before dates, expiration dates, quantities, storage status, and stock movements. 

The international character of the business makes accurate records especially important. Recent trade reporting indicates that demand for Vietnamese coffee exports has been growing in Asian markets, including the Philippines, while high prices and changing stock behavior increase the importance of timely supply information (Nguyen, 2024). Coffee-supply-chain research likewise identifies information visibility and accuracy as critical factors and recommends smart operations, security systems, and collaborative platforms to improve performance (Azis & Irjayanti, 2024). These findings support a system that records each receiving and issuing event rather than relying only on a periodically edited total. 

Traceability is also relevant to specialty coffee because customers may associate quality with origin and production information. Coffee traceability systems may support monitoring, market legitimacy, and sustainability communication (Bravo et al., 2022). Digital traceability has also progressed from paper-based practices toward integrated systems, although affordability, 

infrastructure, and user adoption remain practical constraints (Tadesse et al., 2024). For a small distributor such as Provi Beans, a focused lot-level inventory system is more appropriate than an expensive enterprise or blockchain platform. The proposed system will preserve the essential chain of records from supplier delivery to lot and inventory transaction. 

Expiration and freshness require special treatment. A single product can have multiple lots with different roast, packing, best-before, or expiration dates. A total quantity without lot separation cannot reliably identify which stock should be released first. The GS1 traceability guidance identifies batch or lot number and date information as key data elements for distinguishing otherwise identical products and supporting traceability (GS1, 2024). Consequently, the proposed system will store date information per lot, recommend the earliest valid lot through FEFO, warn users before a configurable threshold, and block expired stock from normal issuance. 

The project addresses the following central problem: how can Provi Beans improve the accuracy, traceability, timeliness, and control of its specialty coffee inventory? Specifically, it will answer these questions: (1) How can product, supplier, delivery, and lot data be organized in one reliable repository? (2) How can every stock-in, stock-out, reservation, return, damage, adjustment, and physical count be recorded without allowing negative or inconsistent balances? (3) How can the system monitor low-stock, near-expiry, expired, and quarantined products and support FEFO issuance? (4) How can dashboards, reports, and audit logs help the owner make purchasing and inventory decisions? and (5) How acceptable is the developed system in terms of functional suitability, usability, reliability, performance, and security? 

The rationale for the project is practical and measurable. A centralized system can reduce repeated encoding, provide one current stock view, make discrepancies visible, and create an audit trail for correction and accountability. It can also support customer service by helping staff determine whether a product is available and which lot can be released. The project does not claim to solve all importation, accounting, e-commerce, or logistics concerns. It concentrates on the inventory controls most directly connected to Provi Beans' present distribution operations. 

### **Objectives of the Study** 

The general objective of this study is to design, develop, and evaluate a web-based inventory management system for Provi Beans that improves the accuracy, traceability, timeliness, and 

control of specialty coffee bean inventory sourced from Vietnam and distributed in the Philippines. 

Specifically, this study aims to: 

1. create a centralized repository for products, suppliers, supplier delivery records, lot or batch records, packaging details, and storage status; 

2. record and validate inventory transactions, including stock-in, stock-out, reservation, release, cancellation, return, damage, quarantine, disposal, adjustment, and physical-count reconciliation; 

3. monitor lot-level roast or packing dates, best-before dates, expiration dates, low-stock levels, and reorder points, and recommend the earliest valid stock through FEFO; 

4. provide role-appropriate dashboards, alerts, searchable histories, audit logs, and inventory reports that support operational and purchasing decisions; 

5. protect business and user data through authentication, role-based authorization, validation, secure sessions, backups, and accountable change records; and 

6. evaluate the system through functional, integration, system, performance, security, usability, user-acceptance, and regression testing. 

### **Significance of the Study** 

The proposed system is significant because it transforms inventory from a collection of manually updated totals into a traceable set of products, lots, and transactions. Its contribution is not limited to faster encoding; it establishes business rules that prevent invalid dates, duplicate identifiers, unauthorized changes, negative stock, and accidental issuance of expired inventory. **Provi Beans Owner and Management.** The owner and managers may benefit from a current view of stock on hand, inventory value, low-stock items, near-expiry lots, movement history, and adjustment activity. These records can support purchasing schedules, promotion or disposition decisions for aging stock, and investigation of discrepancies. 

**Inventory Personnel.** Authorized staff may use standardized forms for receiving, issuing, returning, adjusting, and counting inventory. Automatic validation and FEFO recommendations can reduce reliance on memory and lower the risk of encoding or picking the wrong lot. 

**Coffee Shop Owners and Coffee Enthusiasts.** Customers may indirectly benefit from more reliable availability information and improved control over the freshness and traceability of the products released to them. 

**Suppliers and Business Partners.** Consistent delivery and lot records can help Provi Beans identify delivery discrepancies, document partial receipts, and communicate concerns using clear references. 

**Capstone Researchers and the Institution.** The project may serve as a contextualized example of applying database design, web development, cybersecurity, human-computer interaction, testing, and research methods to a real specialty-product distribution problem. 

**Future Researchers and Developers.** Future work may extend the project to barcode or QR scanning, purchase orders, customer ordering, accounting integration, mobile offline support, demand forecasting, multi-warehouse operations, or supplier-facing traceability. 

### **Scope and Limitations** 

The study covers the analysis, design, development, and evaluation of a responsive web-based inventory management system for Provi Beans. The principal users are the administrator, inventory staff, and owner or manager. Data will be gathered through stakeholder interviews, observation of the current inventory workflow, review of available product and stock records, and iterative prototype feedback. Development and testing will be conducted during the capstone period using representative and authorized business data. 

The system will maintain user accounts and roles; product and supplier profiles; coffee attributes; supplier delivery records and receiving details; lot codes; receiving, roast or packing, best-before, and expiration dates; quantities and unit types; reorder levels; near-expiry thresholds; and status values such as available, reserved, quarantined, damaged, returned, expired, disposed, and depleted. It will record all approved inventory movements and preserve who performed an action, when it occurred, the reason, and the related reference. 

The system will calculate available inventory from validated transactions. Stock-out will be prevented when the requested quantity exceeds the available quantity for the selected lot. If several valid lots exist, the system will recommend the lot with the earliest expiration or best-before date. Expired lots will be excluded from normal issuance; near-expiry lots will be flagged; and lots without complete required date information will remain in a review or quarantine state until corrected by an authorized user. Configurable alerts will cover low stock, reorder level, approaching expiration, expired stock, and unresolved count variances. 

Reports will include stock on hand by product and lot, inventory movement history, low-stock and reorder lists, near-expiry and expired lots, damaged and disposed stock, physical-count 

variances, and user activity. Reports may be filtered by date, product, supplier, lot, status, or transaction type and may be exported to a common format such as PDF or CSV. The dashboard will summarize operational exceptions rather than replace the detailed transaction records. 

The system will address edge cases that commonly create unreliable inventory. These include duplicate SKU or lot codes; an expiration date earlier than the receiving, roast, or packing date; zero or negative quantities; partial delivery receipts; unit mismatches; returns from customers; supplier returns; damaged packages; quarantined stock; canceled reservations; reversal of an incorrect transaction; an attempted edit after a reporting period has been closed; concurrent updates by two users; loss of network connection during submission; unauthorized access; and restoration from backup. Corrections will be made through controlled reversal or adjustment entries instead of silently deleting history. 

The project is limited to inventory management for Provi Beans. It will not perform customs clearance, freight forwarding, foreign-exchange settlement, tax filing, full accounting, payroll, online payment processing, or end-to-end e-commerce unless these are later approved as extensions. It will not independently verify the authenticity, laboratory quality, sensory score, legal import status, or actual shelf life of a coffee product; it will store and process the information provided by authorized users and suppliers. Alerts depend on accurate dates, thresholds, and timely data entry. The initial version will support one logical business inventory location, although the data design may allow future warehouse expansion. 

The study will use an iterative development approach and will evaluate the software with selected Provi Beans stakeholders and technical evaluators. Results will therefore describe the developed system and the participating users during the study period; they should not be generalized to all coffee distributors. Production deployment, long-term maintenance, and large-scale load behavior beyond the defined test conditions are outside the capstone's immediate evaluation. 

### **Definition of Terms** 

**Audit Log.** A chronological, protected record of significant user and system actions, including the actor, time, action, affected record, and relevant before-and-after values. 

**Available Stock.** The valid quantity that can be issued after excluding reserved, quarantined, damaged, expired, disposed, or otherwise blocked units. 

**Best-Before Date.** The supplier- or business-provided date indicating the period during which a product is expected to retain its intended quality when properly stored. It is recorded separately from the expiration date when both are available. 

**FEFO.** First-Expired, First-Out is the issuance rule that prioritizes the valid lot with the earliest applicable expiration or best-before date. 

**Inventory Adjustment.** An authorized increase or decrease used to reconcile a documented discrepancy without deleting the original transaction history. 

**Inventory Management System.** The proposed web application that maintains Provi Beans' product, lot, quantity, movement, alert, report, user, and audit records. 

**Lot or Batch.** A distinguishable group of the same product associated with common source, supplier delivery, production, roast, packing, or date information. 

**Low-Stock Level.** A configured quantity at or below which the system warns users that available inventory is becoming insufficient. 

**Near-Expiry.** A valid lot whose expiration or best-before date falls within a configurable number of days from the current date. 

**Provi Beans.** The specialty coffee business that sources coffee beans from Vietnam and distributes them in the Philippines to coffee shop owners and coffee enthusiasts. 

**Quarantine.** A non-issuable status applied to stock that requires review because of incomplete data, suspected damage, quality concerns, return processing, or another exception. 

**Reorder Point.** A configured inventory level that signals when replenishment should be considered, subject to management review and supplier lead time. 

**Reserved Stock.** A quantity temporarily committed to an approved order or request but not yet released from physical inventory. 

**SKU.** Stock Keeping Unit is a unique business identifier assigned to a specific sellable product configuration, such as a particular coffee and package size. 

**Stock Movement.** Any validated event that changes or reserves inventory, including receipt, issue, return, adjustment, damage, disposal, reservation, release, or cancellation. 

**Traceability.** The ability to follow a product lot through recorded supplier, delivery, receiving, status, and movement events within the defined scope of the system. 

