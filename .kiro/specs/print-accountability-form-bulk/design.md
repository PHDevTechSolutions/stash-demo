# Design Document

## Feature: print-accountability-form-bulk

---

## Overview

This feature adds a "Print Accountability Form" button to the inventory table toolbar. When one or more rows are selected and at least one selected item has a non-empty `new_user`, clicking the button groups the selected items by employee, then generates and downloads a single PDF file containing one complete accountability form per unique employee.

The bulk PDF reuses the exact layout established in `generateAccountabilityPDF` inside `inventory-dialog.tsx` — same margins, font sizes, column widths, section order, and static text — so both outputs are visually identical. The new logic lives in a standalone utility module (`utils/generate-bulk-accountability-pdf.ts`) to avoid circular dependencies.

---

## Architecture

```mermaid
flowchart TD
    A[inventory.tsx\nInventory component] -->|selectedIds, activities| B[Grouping logic\ngroupSelectedItems]
    B -->|BulkAccountabilityGroup[]| C[generateBulkAccountabilityPDF\nutils/generate-bulk-accountability-pdf.ts]
    C -->|jsPDF + autoTable| D[PDF blob → browser download]

    subgraph inventory.tsx
        A
        E[Button visibility\ncomputed from selectedIds + items]
        F[isPdfGenerating state\ndisables button during generation]
    end

    subgraph utils/generate-bulk-accountability-pdf.ts
        C
        G[renderEmployeeForm\nper-group page renderer]
        H[Column routing\nasset_type → left or right column]
    end
```

**Key design decisions:**

- **Standalone utility module** — `generateBulkAccountabilityPDF` is exported from `utils/generate-bulk-accountability-pdf.ts`. This keeps `inventory.tsx` free of direct jsPDF imports and avoids a circular dependency with `inventory-dialog.tsx`.
- **Grouping in the component** — `inventory.tsx` performs the `new_user` grouping before calling the utility, keeping the utility pure (input → PDF, no side effects beyond `doc.save()`).
- **Dynamic imports** — jsPDF and jspdf-autotable are dynamically imported inside the async function, matching the existing pattern in `inventory-dialog.tsx` to avoid bloating the initial bundle.
- **No new dialog** — generation starts immediately on button click; no confirmation dialog is needed per the requirements.

---

## Components and Interfaces

### `BulkAccountabilityGroup` (type)

Defined in `utils/generate-bulk-accountability-pdf.ts` and re-exported for use in `inventory.tsx`.

```ts
export interface BulkAccountabilityGroup {
  new_user:   string;
  department: string;
  position:   string;
  items:      InventoryItem[];
}
```

`InventoryItem` is imported from `components/inventory.tsx` (or a shared types file if one is extracted). To avoid a circular import, the interface should be moved to a shared location (e.g., `types/inventory.ts`) or duplicated in the utility with the same shape.

### `generateBulkAccountabilityPDF` (function)

```ts
export async function generateBulkAccountabilityPDF(
  groups: BulkAccountabilityGroup[]
): Promise<void>
```

- Returns immediately if `groups` is empty.
- Creates a single `jsPDF` document.
- Iterates over `groups`; for each group calls the internal `renderEmployeeForm` helper.
- Inserts `doc.addPage()` between groups (not before the first).
- Writes `Page X of Y` footers on every page after all groups are rendered.
- Calls `doc.save(filename)` once with `Accountability_Forms_Bulk_<YYYY-MM-DD>.pdf`.

### `renderEmployeeForm` (internal helper)

```ts
function renderEmployeeForm(
  doc:     jsPDF,
  autoTable: AutoTableFn,
  group:   BulkAccountabilityGroup,
  startY:  number,
  pageW:   number,
  margin:  number,
  contentW: number
): void
```

Renders all sections of one employee's accountability form onto the current page of `doc`, advancing `y` as content is drawn. Mirrors the section-by-section logic of `generateAccountabilityPDF`.

### `groupSelectedItems` (pure helper, exported for testing)

```ts
export function groupSelectedItems(
  items: InventoryItem[]
): BulkAccountabilityGroup[]
```

- Normalises `new_user` with `.trim()` and lowercases for comparison key.
- Items with blank/whitespace/undefined `new_user` are grouped under `"Unknown"`.
- `department` and `position` are taken from the first item in the group (in array order) that has a non-empty value for each field; defaults to `""`.
- Returns groups in the order their first item appears in the input array.
- Groups whose `new_user` key is `"Unknown"` are included in the output (the caller in `inventory.tsx` decides whether to show a toast and skip them).

### Changes to `inventory.tsx`

| Change | Detail |
|---|---|
| Import | `import { generateBulkAccountabilityPDF, groupSelectedItems } from "@/utils/generate-bulk-accountability-pdf"` |
| State | `const [isPdfGenerating, setIsPdfGenerating] = useState(false)` |
| Derived value | `const showPrintButton = selectedIds.size > 0 && [...selectedIds].some(id => { const item = activities.find(a => a.id === id); return item?.new_user?.trim(); })` |
| Handler | `handlePrintBulk` — groups items, validates, calls generator, handles errors |
| Button | Conditionally rendered when `showPrintButton`; disabled + label swap while `isPdfGenerating` |

---

## Data Models

### Column Routing

Each `InventoryItem` in a group is routed to either the Laptop/Desktop column or the Monitor column based on `asset_type`:

| `asset_type` | Column |
|---|---|
| `"LAPTOP"` | Laptop/Desktop (left) |
| `"DESKTOP"` | Laptop/Desktop (left) |
| `"MONITOR"` | Monitor (right) |
| anything else / null / undefined | Laptop/Desktop (left) — fallback |

### Asset Table Row Structure

The asset details table has 9 data rows plus 1 inclusion row, matching `generateAccountabilityPDF` exactly:

| Row | Left label | Right label |
|---|---|---|
| 0 | Brand / Model | Brand / Model |
| 1 | Processor | Serial Number |
| 2 | RAM | Asset Tag |
| 3 | Storage | Brand / Model |
| 4 | OS | Serial Number |
| 5 | Serial Number | Asset Tag |
| 6 | Mac Address | (blank) |
| 7 | Date Purchase | (blank) |
| 8 | Amount | Amount |
| 9 | Inclusion (colSpan 4) | — |

When a group contains multiple items of the same column type (e.g., two laptops), each item occupies its own row set. The table grows vertically; jsPDF-autotable handles page overflow automatically.

### PDF Layout Constants

These values are copied verbatim from `generateAccountabilityPDF` and must not diverge:

```ts
const margin   = 18;                        // mm
const pageW    = 210;                       // A4 portrait
const contentW = pageW - margin * 2;        // 174 mm

// Column widths
col0 = contentW * 0.22   // ~38.28 mm  — left label
col1 = contentW * 0.28   // ~48.72 mm  — left value
col2 = contentW * 0.22   // ~38.28 mm  — right label
col3 = contentW * 0.28   // ~48.72 mm  — right value
```

### File Naming

```ts
const isoDate  = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
const filename = `Accountability_Forms_Bulk_${isoDate}.pdf`;
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Button visibility matches selection state

*For any* array of `InventoryItem` values and any subset of their IDs in `selectedIds`, the "Print Accountability Form" button SHALL be visible if and only if `selectedIds` is non-empty AND at least one item whose ID is in `selectedIds` has a non-empty (non-whitespace) `new_user` value.

**Validates: Requirements 1.1, 1.2, 1.3**

---

### Property 2: Column routing is total and correct

*For any* `InventoryItem`, the column-routing function SHALL assign the item to exactly one column: items with `asset_type` `"LAPTOP"` or `"DESKTOP"` go to the Laptop/Desktop column; items with `asset_type` `"MONITOR"` go to the Monitor column; all other values (including null/undefined) go to the Laptop/Desktop column as a fallback. The opposite column's fields SHALL be left blank.

**Validates: Requirements 2.1, 2.2, 2.3**

---

### Property 3: Grouping partitions items correctly

*For any* non-empty array of `InventoryItem` values, `groupSelectedItems` SHALL produce a set of `BulkAccountabilityGroup` values such that:
- Every input item appears in exactly one group (partition — no item is lost or duplicated).
- Items are grouped by `new_user` using case-insensitive comparison.
- Items with blank/whitespace/undefined `new_user` are placed in the `"Unknown"` group.
- The total count of items across all groups equals the count of input items.

**Validates: Requirements 3.1, 3.2, 3.4**

---

### Property 4: Group metadata derives from first non-empty item

*For any* group produced by `groupSelectedItems`, the `department` field SHALL equal the `department` of the first item (in input array order) within that group that has a non-empty `department` value, or `""` if no such item exists. The same rule applies to `position`.

**Validates: Requirements 3.3**

---

### Property 5: One PDF file produced per invocation

*For any* non-empty array of `BulkAccountabilityGroup` values passed to `generateBulkAccountabilityPDF`, exactly one call to `doc.save()` SHALL be made, producing exactly one downloaded file.

**Validates: Requirements 4.1, 6.6**

---

### Property 6: Page numbers are present on every page

*For any* invocation of `generateBulkAccountabilityPDF` that produces N pages, every page i (1 ≤ i ≤ N) SHALL contain a footer with the text `Page i of N` at the bottom-right.

**Validates: Requirements 5.7**

---

### Property 7: Mixed-type groups populate both columns

*For any* `BulkAccountabilityGroup` whose `items` array contains at least one item with `asset_type` `"LAPTOP"` or `"DESKTOP"` AND at least one item with `asset_type` `"MONITOR"`, the rendered asset details table SHALL have non-blank values in both the Laptop/Desktop column and the Monitor column.

**Validates: Requirements 7.3**

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| All selected items have blank `new_user` | `groupSelectedItems` returns only an `"Unknown"` group; `handlePrintBulk` in `inventory.tsx` calls `toast.error(...)` and returns without invoking the generator |
| `generateBulkAccountabilityPDF` called with `[]` | Returns immediately (`Promise<void>`) without creating a jsPDF instance or calling `doc.save()` |
| jsPDF / jspdf-autotable dynamic import fails | The `await import(...)` rejects; the `try/catch` in `handlePrintBulk` catches it, calls `toast.error("Failed to generate PDF")`, and re-enables the button |
| Unexpected runtime error inside the generator | Same `try/catch` in `handlePrintBulk` handles it |
| Button clicked while `isPdfGenerating` is true | Button is `disabled`; click events are ignored by the browser |

---

## Testing Strategy

### Unit Tests (example-based)

Located in `utils/__tests__/generate-bulk-accountability-pdf.test.ts` and `components/__tests__/inventory.test.tsx`.

- **Grouping — basic cases**: single item, two items same user, two items different users, item with blank `new_user` → `"Unknown"`.
- **Grouping — case insensitivity**: `"Alice"` and `"alice"` merge into one group.
- **Grouping — metadata derivation**: first non-empty `department`/`position` wins; all-empty defaults to `""`.
- **Column routing**: LAPTOP → left, DESKTOP → left, MONITOR → right, unknown → left fallback.
- **Empty input**: `generateBulkAccountabilityPDF([])` resolves without calling `doc.save()`.
- **Filename format**: verify `doc.save` is called with a string matching `/^Accountability_Forms_Bulk_\d{4}-\d{2}-\d{2}\.pdf$/`.
- **Button visibility**: rendered with 0 selected → no button; rendered with 1 selected (non-empty user) → button present; rendered with 1 selected (blank user) → no button.
- **Button state during generation**: mock generator with a delayed promise; verify button is disabled and label is "Generating PDF..." while pending, then restored on resolution.
- **Error path**: mock generator to throw; verify `toast.error` is called and button is re-enabled.

### Property-Based Tests

Use **fast-check** (already compatible with the TypeScript/Jest stack common in Next.js projects). Each property test runs a minimum of **100 iterations**.

Located in `utils/__tests__/generate-bulk-accountability-pdf.property.test.ts`.

```
// Tag format: Feature: print-accountability-form-bulk, Property N: <property text>
```

**Property 1 — Button visibility matches selection state**
Generate: random `InventoryItem[]` with varying `new_user` values; random subset of IDs as `selectedIds`.
Assert: `showPrintButton(items, selectedIds)` equals `selectedIds.size > 0 && someSelectedItemHasNonEmptyUser(items, selectedIds)`.

**Property 2 — Column routing is total and correct**
Generate: random `InventoryItem` with `asset_type` drawn from `["LAPTOP", "DESKTOP", "MONITOR", "OTHER", null, undefined]`.
Assert: `routeItem(item)` returns `{ left: ..., right: ... }` where exactly one side is populated per the routing rules.

**Property 3 — Grouping partitions items correctly**
Generate: random `InventoryItem[]` (length 1–50) with `new_user` drawn from a small alphabet to force collisions.
Assert: union of all group items equals the input set; no item appears in more than one group; items with blank `new_user` are in the `"Unknown"` group.

**Property 4 — Group metadata derives from first non-empty item**
Generate: random `InventoryItem[]` where `department` and `position` are independently nullable.
Assert: for each group, `group.department` equals the `department` of the first item in that group with a non-empty value, or `""`.

**Property 5 — One PDF file produced per invocation**
Generate: random `BulkAccountabilityGroup[]` (length 1–10) with valid data.
Assert: mock `doc.save` is called exactly once after `generateBulkAccountabilityPDF(groups)` resolves.

**Property 6 — Page numbers on every page**
Generate: random `BulkAccountabilityGroup[]` that produce varying page counts.
Assert: after generation, every page in the document has a footer matching `Page X of Y` where X and Y are correct.

**Property 7 — Mixed-type groups populate both columns**
Generate: `BulkAccountabilityGroup` where `items` contains at least one laptop/desktop item and at least one monitor item (both randomly generated).
Assert: the rendered table body has non-blank values in both the left-value column and the right-value column.

### Integration / Smoke Tests

- **TypeScript compilation**: `tsc --noEmit` passes with the new module — verifies the `BulkAccountabilityGroup` interface and function signature are correct.
- **File existence**: `utils/generate-bulk-accountability-pdf.ts` exports `generateBulkAccountabilityPDF` and `groupSelectedItems`.
- **No circular dependency**: static analysis (e.g., `madge`) confirms no cycle between `inventory.tsx`, `inventory-dialog.tsx`, and the new utility.
