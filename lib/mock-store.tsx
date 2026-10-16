"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Role = "ADMIN" | "INVENTORY_STAFF" | "OWNER";
export type MovementType =
  | "RECEIPT"
  | "ISSUE"
  | "RESERVE"
  | "RELEASE"
  | "CANCEL"
  | "RETURN"
  | "DAMAGE"
  | "QUARANTINE"
  | "UNQUARANTINE"
  | "DISPOSE"
  | "ADJUSTMENT"
  | "COUNT";
export type LotStatus = "ACTIVE" | "QUARANTINE" | "DEPLETED" | "DISPOSED";
export type RequestStatus = "NEW" | "CONFIRMED" | "FULFILLED" | "CANCELLED";
export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type User = {
  id: number;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  originCountry: string;
  originRegion: string | null;
  species: string | null;
  process: string | null;
  roastLevel: string | null;
  weightGrams: number;
  unitPrice: number;
  lowStockLevel: number;
  reorderPoint: number;
  nearExpiryDays: number;
  isActive: boolean;
};

export type Supplier = {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  address: string | null;
  notes: string | null;
};

export type Delivery = {
  id: number;
  supplierId: number;
  reference: string | null;
  receivedAt: string;
  notes: string | null;
};

export type Lot = {
  id: number;
  code: string;
  productId: number;
  deliveryId: number | null;
  receivedAt: string;
  roastDate: string | null;
  packDate: string | null;
  bestBeforeDate: string | null;
  expiryDate: string | null;
  status: LotStatus;
  quarantineReason: string | null;
  notes: string | null;
};

export type Movement = {
  id: number;
  lotId: number;
  productId: number;
  type: MovementType;
  quantity: number;
  reason: string | null;
  reference: string | null;
  reversesId: number | null;
  createdAt: string;
};

export type AuditEntry = {
  id: number;
  actorName: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: string | null;
  after: string | null;
  createdAt: string;
};

export type OrderLine = {
  id: number;
  productId: number;
  quantityRequested: number;
  quantityReserved: number;
  status: "RESERVED" | "PARTIAL" | "SHORT" | "CANCELLED";
  note: string | null;
  allocations: { lotId: number; quantity: number }[];
};

export type OrderRequest = {
  id: number;
  reference: string;
  customerName: string;
  business: string | null;
  email: string;
  phone: string | null;
  notes: string | null;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
};

export type NotificationItem = {
  id: number;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type MockState = {
  version: 1;
  currentUserId: number | null;
  users: User[];
  products: Product[];
  suppliers: Supplier[];
  deliveries: Delivery[];
  lots: Lot[];
  movements: Movement[];
  requests: OrderRequest[];
  audit: AuditEntry[];
  notifications: NotificationItem[];
  cart: Record<string, number>;
};

export type FormState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  reference?: string;
  shortLines?: { sku: string; requested: number; reserved: number; note: string | null }[];
};

export type LotView = {
  lot: Lot;
  product: Product;
  onHand: number;
  reserved: number;
  available: number;
  effectiveDate: string;
  daysToExpiry: number;
  isExpired: boolean;
  isNearExpiry: boolean;
  isQuarantined: boolean;
  isIssuable: boolean;
};

const STORAGE_KEY = "provi-beans-mock-store-v1";
export const DEMO_PASSWORD = "ProviBeans2026";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  INVENTORY_STAFF: "Inventory staff",
  OWNER: "Owner / manager",
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  RECEIPT: "Stock received",
  ISSUE: "Issued",
  RESERVE: "Reserved",
  RELEASE: "Reservation released",
  CANCEL: "Reservation cancelled",
  RETURN: "Returned",
  DAMAGE: "Damaged",
  QUARANTINE: "Quarantined",
  UNQUARANTINE: "Released from quarantine",
  DISPOSE: "Disposed",
  ADJUSTMENT: "Adjusted",
  COUNT: "Physical count",
};

export const ON_HAND_EFFECT: Partial<Record<MovementType, -1 | 1>> = {
  RECEIPT: 1,
  ISSUE: -1,
  RETURN: 1,
  DAMAGE: -1,
  DISPOSE: -1,
  ADJUSTMENT: 1,
  COUNT: 1,
};

export const RESERVED_EFFECT: Partial<Record<MovementType, -1 | 1>> = {
  RESERVE: 1,
  RELEASE: -1,
  CANCEL: -1,
};

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function timestampDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function seedState(): MockState {
  const users: User[] = [
    { id: 1, email: "admin@provibeans.ph", name: "Ariel Mendoza", role: "ADMIN", isActive: true },
    { id: 2, email: "staff@provibeans.ph", name: "Jenna Cruz", role: "INVENTORY_STAFF", isActive: true },
    { id: 3, email: "owner@provibeans.ph", name: "Rowan Provi", role: "OWNER", isActive: true },
  ];
  const products: Product[] = [
    { id: 1, sku: "PB-HN-250", name: "Hà Nội Say Hi City Blend", originCountry: "Vietnam", originRegion: "Hanoi Province", species: "Robusta / Arabica", process: "Washed", roastLevel: "Medium", weightGrams: 250, unitPrice: 285, lowStockLevel: 24, reorderPoint: 60, nearExpiryDays: 30, isActive: true },
    { id: 2, sku: "PB-HUE-250", name: "Huế Say Hi 60/40", originCountry: "Vietnam", originRegion: "Thừa Thiên Huế", species: "60% Robusta · 40% Arabica", process: "Washed", roastLevel: "Medium-dark", weightGrams: 250, unitPrice: 310, lowStockLevel: 24, reorderPoint: 60, nearExpiryDays: 30, isActive: true },
    { id: 3, sku: "PB-SGN-250", name: "Saigon Say Hi 100% Robusta", originCountry: "Vietnam", originRegion: "Ho Chi Minh City", species: "Robusta", process: "Natural", roastLevel: "Dark", weightGrams: 250, unitPrice: 265, lowStockLevel: 30, reorderPoint: 80, nearExpiryDays: 30, isActive: true },
  ];
  const suppliers: Supplier[] = [
    { id: 1, name: "Central Highlands Cooperative", contactName: "Nguyen Thi Lan", email: "orders@chighlands.vn", phone: "+84 263 3820 117", country: "Vietnam", address: "12 Nguyen Trai, Da Lat, Lam Dong", notes: "Primary supplier. Delivers monthly, wet-milled robusta." },
    { id: 2, name: "Northwind Export House", contactName: "Tran Bao", email: "sales@northwindexport.vn", phone: "+84 4 3936 1188", country: "Vietnam", address: "88 Hang Giay, Hanoi", notes: "Secondary supplier for arabica blends." },
  ];
  const deliveries: Delivery[] = [
    { id: 1, supplierId: 1, reference: "CH-2026-018", receivedAt: timestampDaysAgo(120), notes: "Full monthly allocation." },
    { id: 2, supplierId: 2, reference: "NE-2026-044", receivedAt: timestampDaysAgo(45), notes: "Partial receipt, second pallet short by 20 bags." },
    { id: 3, supplierId: 1, reference: "CH-2026-022", receivedAt: timestampDaysAgo(12), notes: "Restock for Huế and Saigon." },
  ];
  const lots: Lot[] = [
    { id: 1, code: "HN-2601-A", productId: 1, deliveryId: 1, receivedAt: timestampDaysAgo(120), roastDate: daysFromNow(-115), packDate: daysFromNow(-110), bestBeforeDate: daysFromNow(60), expiryDate: daysFromNow(95), status: "ACTIVE", quarantineReason: null, notes: "Opening lot." },
    { id: 2, code: "HN-2602-B", productId: 1, deliveryId: 3, receivedAt: timestampDaysAgo(12), roastDate: daysFromNow(-8), packDate: daysFromNow(-6), bestBeforeDate: daysFromNow(11), expiryDate: daysFromNow(26), status: "ACTIVE", quarantineReason: null, notes: "Will trip the near-expiry threshold." },
    { id: 3, code: "HUE-2510-A", productId: 2, deliveryId: 1, receivedAt: timestampDaysAgo(120), roastDate: daysFromNow(-118), packDate: daysFromNow(-114), bestBeforeDate: daysFromNow(-30), expiryDate: daysFromNow(-9), status: "ACTIVE", quarantineReason: null, notes: "Already expired, must not issue." },
    { id: 4, code: "HUE-2602-B", productId: 2, deliveryId: 2, receivedAt: timestampDaysAgo(45), roastDate: daysFromNow(-40), packDate: daysFromNow(-37), bestBeforeDate: daysFromNow(38), expiryDate: daysFromNow(74), status: "ACTIVE", quarantineReason: null, notes: "Healthy replacement stock." },
    { id: 5, code: "HUE-2603-DMG", productId: 2, deliveryId: 3, receivedAt: timestampDaysAgo(12), roastDate: daysFromNow(-9), packDate: daysFromNow(-7), bestBeforeDate: daysFromNow(40), expiryDate: daysFromNow(76), status: "QUARANTINE", quarantineReason: "Transit damage pending supplier claim", notes: "Suffered transit damage, held for review." },
    { id: 6, code: "SGN-2601-A", productId: 3, deliveryId: 1, receivedAt: timestampDaysAgo(120), roastDate: daysFromNow(-114), packDate: daysFromNow(-109), bestBeforeDate: daysFromNow(52), expiryDate: daysFromNow(88), status: "ACTIVE", quarantineReason: null, notes: "Bulk stock, heavily issued." },
    { id: 7, code: "SGN-2602-B", productId: 3, deliveryId: 3, receivedAt: timestampDaysAgo(12), roastDate: daysFromNow(-7), packDate: daysFromNow(-5), bestBeforeDate: daysFromNow(43), expiryDate: daysFromNow(79), status: "ACTIVE", quarantineReason: null, notes: "Latest arrival." },
  ];
  const raw = [
    [1, "RECEIPT", 300, "Full delivery", null, 120], [1, "ISSUE", 120, "Reyes Coffee", "SO-1041", 40], [1, "ISSUE", 45, "Morning Brew PH", "SO-1058", 9],
    [2, "RECEIPT", 150, "Restock", null, 12], [2, "ISSUE", 26, "Kape Manila", "SO-1102", 5],
    [3, "RECEIPT", 240, "Full delivery", null, 120], [3, "ISSUE", 180, "Issued before expiry window closed", null, 30],
    [4, "RECEIPT", 200, "Partial receipt", null, 45], [4, "ISSUE", 65, "Studio Nine", "SO-1063", 20],
    [5, "RECEIPT", 80, "Restock", null, 12], [5, "DAMAGE", 14, "Split seams on transit", null, 10],
    [6, "RECEIPT", 400, "Full delivery", null, 120], [6, "ISSUE", 372, "Consistent supply", null, 60], [6, "RETURN", 8, "Customer return, intact", null, 18],
    [7, "RECEIPT", 220, "Restock", null, 12], [7, "ISSUE", 64, "Cafe Adriatico", "SO-1101", 4], [7, "RESERVE", 30, "Held for confirmed order", null, 2],
  ] as const;
  const movements: Movement[] = raw.map(([lotId, type, quantity, reason, reference, ago], index) => ({
    id: index + 1,
    lotId,
    productId: lots.find((lot) => lot.id === lotId)?.productId ?? 1,
    type,
    quantity,
    reason,
    reference,
    reversesId: null,
    createdAt: timestampDaysAgo(ago),
  }));
  return {
    version: 1,
    currentUserId: null,
    users,
    products,
    suppliers,
    deliveries,
    lots,
    movements,
    requests: [
      { id: 1, reference: "ORD-2026-0007", customerName: "Mara Santos", business: "Kettle and Co", email: "mara@kettle.example", phone: "+63 917 555 0117", notes: "Please confirm the Friday delivery window.", status: "NEW", createdAt: timestampDaysAgo(2), updatedAt: timestampDaysAgo(2), lines: [{ id: 1, productId: 1, quantityRequested: 18, quantityReserved: 18, status: "RESERVED", note: null, allocations: [{ lotId: 2, quantity: 18 }] }] },
    ],
    audit: [
      { id: 1, actorName: "Jenna Cruz", action: "RECEIVE", entity: "delivery", entityId: "CH-2026-018", before: null, after: JSON.stringify({ lots: 3 }), createdAt: timestampDaysAgo(120) },
      { id: 2, actorName: "Ariel Mendoza", action: "QUARANTINE", entity: "lot", entityId: "HUE-2603-DMG", before: JSON.stringify({ status: "ACTIVE" }), after: JSON.stringify({ status: "QUARANTINE" }), createdAt: timestampDaysAgo(10) },
    ],
    notifications: [
      { id: 101, type: "EXPIRED", severity: "CRITICAL", title: "Lot expired", message: "Lot HUE-2510-A has expired and still holds stock. It cannot be issued.", entityType: "lot", entityId: "3", readAt: null, createdAt: timestampDaysAgo(0.01) },
      { id: 102, type: "LOW_STOCK", severity: "CRITICAL", title: "Low stock", message: "PB-SGN-250 is below its low-stock level.", entityType: "product", entityId: "3", readAt: null, createdAt: timestampDaysAgo(0.08) },
      { id: 103, type: "ORDER_RECEIVED", severity: "INFO", title: "New order request", message: "Request ORD-2026-0007 from Kettle and Co is awaiting confirmation.", entityType: "order_request", entityId: "1", readAt: null, createdAt: timestampDaysAgo(2) },
      { id: 104, type: "QUARANTINE", severity: "WARNING", title: "Lot quarantined", message: "Lot HUE-2603-DMG is quarantined pending review.", entityType: "lot", entityId: "5", readAt: timestampDaysAgo(1), createdAt: timestampDaysAgo(2) },
    ],
    cart: {},
  };
}

function nextId(rows: { id: number }[]): number {
  return Math.max(0, ...rows.map((row) => row.id)) + 1;
}

function cloneState(state: MockState): MockState {
  return structuredClone(state);
}

function saveState(state: MockState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

function loadState(): MockState {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return seedState();
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || !("version" in parsed) || parsed.version !== 1) return seedState();
    return parsed as MockState;
  } catch {
    return seedState();
  }
}

export function currentUser(state: MockState): User | null {
  return state.users.find((user) => user.id === state.currentUserId && user.isActive) ?? null;
}

export function canManageMasterData(role: Role): boolean {
  return role === "ADMIN" || role === "OWNER";
}

export function canViewReports(role: Role): boolean {
  return role === "ADMIN" || role === "OWNER";
}

export function balancesForLot(state: MockState, lotId: number): { onHand: number; reserved: number } {
  return state.movements.filter((movement) => movement.lotId === lotId).reduce(
    (balance, movement) => {
      const onHand = ON_HAND_EFFECT[movement.type];
      const reserved = RESERVED_EFFECT[movement.type];
      if (onHand) balance.onHand += onHand * movement.quantity;
      if (reserved) balance.reserved += reserved * movement.quantity;
      return balance;
    },
    { onHand: 0, reserved: 0 },
  );
}

export function effectiveDate(lot: Lot): string {
  return lot.expiryDate ?? lot.bestBeforeDate ?? lot.receivedAt.slice(0, 10);
}

export function buildLotViews(state: MockState): LotView[] {
  const today = new Date().toISOString().slice(0, 10);
  return state.lots
    .map((lot) => {
      const product = state.products.find((entry) => entry.id === lot.productId);
      if (!product) return null;
      const { onHand, reserved } = balancesForLot(state, lot.id);
      const date = effectiveDate(lot);
      const daysToExpiry = Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86_400_000);
      const isExpired = daysToExpiry < 0;
      const isQuarantined = lot.status === "QUARANTINE";
      const isIssuable = lot.status === "ACTIVE" && !isExpired;
      return {
        lot,
        product,
        onHand,
        reserved,
        available: isIssuable ? Math.max(0, onHand - reserved) : 0,
        effectiveDate: date,
        daysToExpiry,
        isExpired,
        isNearExpiry: !isExpired && daysToExpiry <= product.nearExpiryDays,
        isQuarantined,
        isIssuable,
      };
    })
    .filter((view): view is LotView => view !== null)
    .sort((left, right) => left.lot.code.localeCompare(right.lot.code));
}

export function productSummaries(state: MockState) {
  const views = buildLotViews(state);
  return [...state.products].sort((a, b) => a.sku.localeCompare(b.sku)).map((product) => {
    const own = views.filter((view) => view.lot.productId === product.id);
    const onHand = own.reduce((sum, view) => sum + view.onHand, 0);
    const reserved = own.reduce((sum, view) => sum + view.reserved, 0);
    const available = own.reduce((sum, view) => sum + view.available, 0);
    const expiredHold = own.some((view) => view.isExpired && view.onHand > 0);
    const stockState = expiredHold ? "EXPIRED_HOLD" : available <= product.lowStockLevel ? "LOW" : available <= product.reorderPoint ? "REORDER" : "OK";
    return { product, onHand, reserved, available, inventoryValue: onHand * product.unitPrice, lotCount: own.length, stockState };
  });
}

export function openAlerts(state: MockState) {
  const alerts: { id: string; type: string; severity: NotificationSeverity; message: string }[] = [];
  for (const summary of productSummaries(state)) {
    if (summary.stockState === "LOW") alerts.push({ id: `low-${summary.product.id}`, type: "LOW_STOCK", severity: "CRITICAL", message: `${summary.product.sku} has ${summary.available} available, at or below its low-stock level of ${summary.product.lowStockLevel}.` });
    else if (summary.stockState === "REORDER") alerts.push({ id: `reorder-${summary.product.id}`, type: "REORDER", severity: "WARNING", message: `${summary.product.sku} has reached its reorder point.` });
  }
  for (const view of buildLotViews(state)) {
    if (view.isExpired && view.onHand > 0) alerts.push({ id: `expired-${view.lot.id}`, type: "EXPIRED", severity: "CRITICAL", message: `Lot ${view.lot.code} has expired and still holds ${view.onHand} unit(s).` });
    else if (view.isQuarantined) alerts.push({ id: `quarantine-${view.lot.id}`, type: "QUARANTINE", severity: "WARNING", message: `Lot ${view.lot.code} is quarantined: ${view.lot.quarantineReason ?? "no reason recorded"}.` });
    else if (view.isNearExpiry && view.onHand > 0) alerts.push({ id: `near-${view.lot.id}`, type: "NEAR_EXPIRY", severity: "WARNING", message: `Lot ${view.lot.code} reaches its effective date in ${view.daysToExpiry} day(s).` });
  }
  return alerts;
}

export function fefoPlan(state: MockState, productId: number) {
  return buildLotViews(state)
    .filter((view) => view.product.id === productId && view.isIssuable && view.available > 0)
    .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
    .map((view) => ({ lotId: view.lot.id, lotCode: view.lot.code, effectiveDate: view.effectiveDate, daysToExpiry: view.daysToExpiry, available: view.available }));
}

type Store = {
  state: MockState;
  hydrated: boolean;
  user: User | null;
  login: (email: string, password: string) => FormState;
  logout: () => void;
  reset: () => void;
  createLot: (input: Omit<Lot, "id" | "status" | "quarantineReason"> & { quantity: number }) => FormState;
  quarantineLot: (lotId: number, reason: string) => FormState;
  releaseLot: (lotId: number) => FormState;
  issueStock: (input: { productId: number; quantity: number; lotId: number | null; reason: string | null; reference: string | null }) => FormState;
  adjustStock: (input: { lotId: number; type: MovementType; quantity: number; reason: string; reference: string | null }) => FormState;
  reverseMovement: (movementId: number, reason: string) => FormState;
  createProduct: (product: Omit<Product, "id" | "isActive">) => FormState;
  createSupplier: (supplier: Omit<Supplier, "id">) => FormState;
  createDelivery: (delivery: Omit<Delivery, "id">) => FormState;
  updateRequest: (requestId: number, status: Exclude<RequestStatus, "NEW">) => FormState;
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
  pushNotification: (notification: Omit<NotificationItem, "id" | "readAt" | "createdAt">) => NotificationItem;
  setCartQuantity: (productId: number, quantity: number) => FormState;
  checkout: (customer: { customerName: string; business: string | null; email: string; phone: string | null; notes: string | null }) => FormState;
};

const StoreContext = createContext<Store | null>(null);

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MockState>(seedState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    const stored = loadState();
    stateRef.current = stored;
    setState(stored);
    setHydrated(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = loadState();
      stateRef.current = next;
      setState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const commit = useCallback((change: (draft: MockState) => void): MockState => {
    const next = cloneState(stateRef.current);
    change(next);
    stateRef.current = next;
    setState(next);
    saveState(next);
    return next;
  }, []);

  const actorName = useCallback(() => currentUser(stateRef.current)?.name ?? "Demo user", []);
  const audit = useCallback((draft: MockState, action: string, entity: string, entityId: string | null, before: unknown, after: unknown) => {
    draft.audit.push({ id: nextId(draft.audit), actorName: actorName(), action, entity, entityId, before: before == null ? null : JSON.stringify(before), after: after == null ? null : JSON.stringify(after), createdAt: new Date().toISOString() });
  }, [actorName]);
  const addMovement = useCallback((draft: MockState, input: Omit<Movement, "id" | "createdAt" | "reversesId"> & { reversesId?: number | null }) => {
    draft.movements.push({ ...input, id: nextId(draft.movements), reversesId: input.reversesId ?? null, createdAt: new Date().toISOString() });
  }, []);

  const login = useCallback((email: string, password: string): FormState => {
    const normal = email.trim().toLowerCase();
    const fieldErrors: Record<string, string> = {};
    if (!normal) fieldErrors.email = "Enter your email address.";
    if (!password) fieldErrors.password = "Enter your password.";
    if (Object.keys(fieldErrors).length) return { fieldErrors };
    const found = stateRef.current.users.find((entry) => entry.email === normal && entry.isActive);
    if (!found || password !== DEMO_PASSWORD) return { error: "That email and password combination was not recognised." };
    commit((draft) => { draft.currentUserId = found.id; });
    return { ok: true };
  }, [commit]);

  const logout = useCallback(() => commit((draft) => { draft.currentUserId = null; }), [commit]);
  const reset = useCallback(() => {
    const next = seedState();
    stateRef.current = next;
    setState(next);
    saveState(next);
  }, []);

  const createLot = useCallback<Store["createLot"]>((input) => {
    const fieldErrors: Record<string, string> = {};
    if (!input.code.trim()) fieldErrors.code = "A lot code is required.";
    if (stateRef.current.lots.some((lot) => lot.code.toLowerCase() === input.code.trim().toLowerCase())) fieldErrors.code = "Already in use.";
    if (!stateRef.current.products.some((product) => product.id === input.productId)) fieldErrors.productId = "Choose a product.";
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) fieldErrors.quantity = "Enter a whole number above zero.";
    const dates = [input.roastDate, input.packDate, input.bestBeforeDate, input.expiryDate].filter((date): date is string => Boolean(date));
    if (input.expiryDate && dates.some((date) => date > input.expiryDate!)) fieldErrors.expiryDate = "Expiry must be the latest date.";
    if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
    commit((draft) => {
      const lot: Lot = { ...input, id: nextId(draft.lots), code: input.code.trim().toUpperCase(), status: "ACTIVE", quarantineReason: null };
      draft.lots.push(lot);
      addMovement(draft, { lotId: lot.id, productId: lot.productId, type: "RECEIPT", quantity: input.quantity, reason: "Stock received", reference: input.deliveryId ? draft.deliveries.find((delivery) => delivery.id === input.deliveryId)?.reference ?? null : null });
      audit(draft, "RECEIVE", "lot", lot.code, null, { quantity: input.quantity });
    });
    return { ok: true, message: `${input.code.trim().toUpperCase()} received.` };
  }, [addMovement, audit, commit]);

  const quarantineLot = useCallback((lotId: number, reason: string): FormState => {
    if (!reason.trim()) return { error: "A quarantine reason is required.", fieldErrors: { reason: "Required." } };
    const lot = stateRef.current.lots.find((entry) => entry.id === lotId);
    if (!lot) return { error: "Lot not found." };
    commit((draft) => {
      const target = draft.lots.find((entry) => entry.id === lotId)!;
      target.status = "QUARANTINE";
      target.quarantineReason = reason.trim();
      addMovement(draft, { lotId, productId: target.productId, type: "QUARANTINE", quantity: Math.max(1, balancesForLot(draft, lotId).onHand), reason: reason.trim(), reference: null });
      audit(draft, "QUARANTINE", "lot", target.code, { status: lot.status }, { status: target.status });
    });
    return { ok: true, message: `${lot.code} quarantined.` };
  }, [addMovement, audit, commit]);

  const releaseLot = useCallback((lotId: number): FormState => {
    const lot = stateRef.current.lots.find((entry) => entry.id === lotId);
    if (!lot) return { error: "Lot not found." };
    commit((draft) => {
      const target = draft.lots.find((entry) => entry.id === lotId)!;
      target.status = "ACTIVE";
      target.quarantineReason = null;
      addMovement(draft, { lotId, productId: target.productId, type: "UNQUARANTINE", quantity: Math.max(1, balancesForLot(draft, lotId).onHand), reason: "Released from quarantine", reference: null });
      audit(draft, "UNQUARANTINE", "lot", target.code, { status: lot.status }, { status: target.status });
    });
    return { ok: true, message: `${lot.code} released to available stock.` };
  }, [addMovement, audit, commit]);

  const issueStock = useCallback<Store["issueStock"]>((input) => {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) return { error: "Enter a whole number above zero.", fieldErrors: { quantity: "Invalid quantity." } };
    const plans = input.lotId
      ? fefoPlan(stateRef.current, input.productId).filter((plan) => plan.lotId === input.lotId)
      : fefoPlan(stateRef.current, input.productId);
    if (plans.reduce((sum, plan) => sum + plan.available, 0) < input.quantity) return { error: "There is not enough issuable stock for this movement." };
    commit((draft) => {
      let remaining = input.quantity;
      for (const plan of plans) {
        const quantity = Math.min(plan.available, remaining);
        if (quantity <= 0) continue;
        addMovement(draft, { lotId: plan.lotId, productId: input.productId, type: "ISSUE", quantity, reason: input.reason, reference: input.reference });
        remaining -= quantity;
        if (remaining === 0) break;
      }
      audit(draft, "ISSUE", "product", String(input.productId), null, { quantity: input.quantity });
    });
    return { ok: true, message: `${input.quantity} unit${input.quantity === 1 ? "" : "s"} issued.` };
  }, [addMovement, audit, commit]);

  const adjustStock = useCallback<Store["adjustStock"]>((input): FormState => {
    const lot = stateRef.current.lots.find((entry) => entry.id === input.lotId);
    if (!lot) return { error: "Choose a valid lot.", fieldErrors: { lotId: "Invalid lot." } };
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) return { error: "Enter a whole number above zero.", fieldErrors: { quantity: "Invalid quantity." } };
    const balance = balancesForLot(stateRef.current, input.lotId);
    if (["DAMAGE", "DISPOSE"].includes(input.type) && input.quantity > balance.onHand - balance.reserved) return { error: "That movement exceeds unreserved stock." };
    if (["RELEASE", "CANCEL"].includes(input.type) && input.quantity > balance.reserved) return { error: "That movement exceeds reserved stock." };
    commit((draft) => {
      addMovement(draft, { ...input, productId: lot.productId });
      audit(draft, input.type, "lot", lot.code, null, { quantity: input.quantity });
    });
    return { ok: true, message: `${MOVEMENT_LABELS[input.type]} on ${lot.code}.` };
  }, [addMovement, audit, commit]);

  const reverseMovement = useCallback((movementId: number, reason: string): FormState => {
    const original = stateRef.current.movements.find((movement) => movement.id === movementId);
    if (!original) return { error: "Movement not found." };
    if (stateRef.current.movements.some((movement) => movement.reversesId === movementId)) return { error: "This movement has already been reversed." };
    commit((draft) => {
      addMovement(draft, { lotId: original.lotId, productId: original.productId, type: original.type, quantity: -original.quantity, reason: reason.trim() || `Reversal of #${movementId}`, reference: original.reference, reversesId: movementId });
      audit(draft, "REVERSE", "movement", String(movementId), original, null);
    });
    return { ok: true, message: `Movement #${movementId} reversed.` };
  }, [addMovement, audit, commit]);

  const createProduct = useCallback<Store["createProduct"]>((product) => {
    const fieldErrors: Record<string, string> = {};
    if (!product.sku.trim()) fieldErrors.sku = "A SKU is required.";
    if (!product.name.trim()) fieldErrors.name = "A product name is required.";
    if (stateRef.current.products.some((entry) => entry.sku === product.sku.trim().toUpperCase())) fieldErrors.sku = "Already in use.";
    if (!Number.isInteger(product.weightGrams) || product.weightGrams <= 0) fieldErrors.weightGrams = "Enter a whole number above zero.";
    if (!Number.isFinite(product.unitPrice) || product.unitPrice < 0) fieldErrors.unitPrice = "Enter a price of zero or more.";
    if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };
    const sku = product.sku.trim().toUpperCase();
    commit((draft) => { draft.products.push({ ...product, id: nextId(draft.products), sku, isActive: true }); });
    return { ok: true, message: `${sku} added to the catalogue.` };
  }, [commit]);

  const createSupplier = useCallback<Store["createSupplier"]>((supplier) => {
    if (!supplier.name.trim()) return { error: "A supplier name is required.", fieldErrors: { name: "Required." } };
    if (stateRef.current.suppliers.some((entry) => entry.name.toLowerCase() === supplier.name.trim().toLowerCase())) return { error: `${supplier.name} is already recorded.`, fieldErrors: { name: "Already recorded." } };
    commit((draft) => { draft.suppliers.push({ ...supplier, id: nextId(draft.suppliers), name: supplier.name.trim() }); });
    return { ok: true, message: `${supplier.name.trim()} added.` };
  }, [commit]);

  const createDelivery = useCallback<Store["createDelivery"]>((delivery): FormState => {
    if (!stateRef.current.suppliers.some((supplier) => supplier.id === delivery.supplierId)) return { error: "Choose the supplier this delivery came from.", fieldErrors: { supplierId: "Invalid supplier." } };
    if (delivery.reference && stateRef.current.deliveries.some((entry) => entry.reference === delivery.reference)) return { error: `Reference ${delivery.reference} has already been recorded.`, fieldErrors: { reference: "Already used." } };
    commit((draft) => { draft.deliveries.push({ ...delivery, id: nextId(draft.deliveries) }); });
    return { ok: true, message: delivery.reference ? `Delivery ${delivery.reference} recorded.` : "Delivery recorded." };
  }, [commit]);

  const updateRequest = useCallback((requestId: number, status: Exclude<RequestStatus, "NEW">): FormState => {
    const request = stateRef.current.requests.find((entry) => entry.id === requestId);
    if (!request) return { error: "Order request not found." };
    if (request.status === "FULFILLED" || request.status === "CANCELLED") return { error: `This request is already ${request.status.toLowerCase()}.` };
    commit((draft) => {
      const target = draft.requests.find((entry) => entry.id === requestId)!;
      if (status === "CANCELLED") {
        for (const line of target.lines) for (const allocation of line.allocations) addMovement(draft, { lotId: allocation.lotId, productId: line.productId, type: "CANCEL", quantity: allocation.quantity, reason: `Cancelled ${target.reference}`, reference: target.reference });
        target.lines.forEach((line) => { line.status = "CANCELLED"; });
      }
      if (status === "FULFILLED") {
        for (const line of target.lines) for (const allocation of line.allocations) {
          addMovement(draft, { lotId: allocation.lotId, productId: line.productId, type: "RELEASE", quantity: allocation.quantity, reason: `Fulfilled ${target.reference}`, reference: target.reference });
          addMovement(draft, { lotId: allocation.lotId, productId: line.productId, type: "ISSUE", quantity: allocation.quantity, reason: `Fulfilled ${target.reference}`, reference: target.reference });
        }
      }
      target.status = status;
      target.updatedAt = new Date().toISOString();
      audit(draft, `ORDER_${status}`, "order_request", target.reference, request.status, status);
    });
    return { ok: true, message: `${request.reference} ${status.toLowerCase()}.` };
  }, [addMovement, audit, commit]);

  const markNotificationRead = useCallback((id: number) => commit((draft) => {
    const item = draft.notifications.find((notification) => notification.id === id);
    if (item && !item.readAt) item.readAt = new Date().toISOString();
  }), [commit]);
  const markAllNotificationsRead = useCallback(() => commit((draft) => {
    const now = new Date().toISOString();
    draft.notifications.forEach((notification) => { notification.readAt ??= now; });
  }), [commit]);
  const pushNotification = useCallback<Store["pushNotification"]>((notification) => {
    const item: NotificationItem = { ...notification, id: nextId(stateRef.current.notifications), readAt: null, createdAt: new Date().toISOString() };
    commit((draft) => { draft.notifications.unshift(item); });
    return item;
  }, [commit]);

  const setCartQuantity = useCallback((productId: number, quantity: number): FormState => {
    const product = stateRef.current.products.find((entry) => entry.id === productId && entry.isActive);
    if (!product) return { error: "That coffee is not available." };
    if (!Number.isInteger(quantity)) return { error: "Enter a whole number." };
    commit((draft) => { if (quantity <= 0) delete draft.cart[String(productId)]; else draft.cart[String(productId)] = Math.min(500, quantity); });
    return { ok: true, message: quantity <= 0 ? "Item removed." : "Cart updated." };
  }, [commit]);

  const checkout = useCallback<Store["checkout"]>((customer) => {
    if (!customer.customerName.trim() || !customer.email.trim()) return { error: "Enter your name and email address." };
    const cart = stateRef.current.cart;
    const requested = Object.entries(cart).filter(([, quantity]) => quantity > 0);
    if (!requested.length) return { error: "Your cart is empty." };
    const reference = `ORD-${new Date().getFullYear()}-${String(nextId(stateRef.current.requests)).padStart(4, "0")}`;
    const shortLines: NonNullable<FormState["shortLines"]> = [];
    commit((draft) => {
      const requestId = nextId(draft.requests);
      const lines: OrderLine[] = requested.map(([productIdText, quantity], index) => {
        const productId = Number(productIdText);
        const plans = fefoPlan(draft, productId);
        let remaining = quantity;
        const allocations: { lotId: number; quantity: number }[] = [];
        for (const plan of plans) {
          const take = Math.min(plan.available, remaining);
          if (take <= 0) continue;
          allocations.push({ lotId: plan.lotId, quantity: take });
          addMovement(draft, { lotId: plan.lotId, productId, type: "RESERVE", quantity: take, reason: `Held for ${reference}`, reference });
          remaining -= take;
          if (!remaining) break;
        }
        const reserved = quantity - remaining;
        const product = draft.products.find((entry) => entry.id === productId)!;
        if (reserved < quantity) shortLines.push({ sku: product.sku, requested: quantity, reserved, note: remaining ? `${remaining} unit(s) short` : null });
        return { id: index + nextId(draft.requests.flatMap((entry) => entry.lines)), productId, quantityRequested: quantity, quantityReserved: reserved, status: reserved === quantity ? "RESERVED" : reserved ? "PARTIAL" : "SHORT", note: remaining ? `${remaining} unit(s) short` : null, allocations };
      });
      const now = new Date().toISOString();
      draft.requests.push({ id: requestId, reference, ...customer, status: "NEW", createdAt: now, updatedAt: now, lines });
      draft.cart = {};
      draft.notifications.unshift({ id: nextId(draft.notifications), type: "ORDER_RECEIVED", severity: "INFO", title: "New order request", message: `Request ${reference} from ${customer.customerName} is awaiting confirmation.`, entityType: "order_request", entityId: String(requestId), readAt: null, createdAt: now });
    });
    return { ok: true, reference, message: "Your request has been placed and available stock is held.", shortLines };
  }, [addMovement, commit]);

  const value = useMemo<Store>(() => ({
    state,
    hydrated,
    user: currentUser(state),
    login,
    logout,
    reset,
    createLot,
    quarantineLot,
    releaseLot,
    issueStock,
    adjustStock,
    reverseMovement,
    createProduct,
    createSupplier,
    createDelivery,
    updateRequest,
    markNotificationRead,
    markAllNotificationsRead,
    pushNotification,
    setCartQuantity,
    checkout,
  }), [state, hydrated, login, logout, reset, createLot, quarantineLot, releaseLot, issueStock, adjustStock, reverseMovement, createProduct, createSupplier, createDelivery, updateRequest, markNotificationRead, markAllNotificationsRead, pushNotification, setCartQuantity, checkout]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useMockStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useMockStore must be used inside MockStoreProvider");
  return store;
}

export function cartView(state: MockState) {
  const summaries = productSummaries(state);
  const lines = Object.entries(state.cart).flatMap(([productId, quantity]) => {
    const product = state.products.find((entry) => entry.id === Number(productId));
    if (!product) return [];
    const available = summaries.find((entry) => entry.product.id === product.id)?.available ?? 0;
    return [{ product, quantity, lineTotal: quantity * product.unitPrice, available, exceedsAvailable: quantity > available }];
  });
  return { lines, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0), hasUnavailable: lines.some((line) => line.exceedsAvailable) };
}

export function slugForProduct(product: Pick<Product, "sku">): string {
  return product.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function downloadCsv(filename: string, rows: (string | number | null)[][]): void {
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking on the next tick rather than immediately: the browser reads the
  // blob asynchronously, and releasing the URL in the same task can cancel the
  // download before it starts.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
