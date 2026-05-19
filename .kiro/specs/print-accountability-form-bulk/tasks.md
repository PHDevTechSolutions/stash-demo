# Implementation Plan: print-accountability-form-bulk

## Overview

Implement a "Print Accountability Form" button in the inventory toolbar that groups selected rows by employee and generates a single bulk PDF — one accountability form page per unique `new_user` — reusing the exact layout from `generateAccountabilityPDF` in `inventory-dialog.tsx`. The new logic lives in a standalone utility module to avoid circular dependencies.

## Tasks

- [x] 1. Create the bulk PDF utility module
  - [x] 1.1 Define `BulkAccountabilityGroup` interface and `InventoryItem` import in `utils/generate-bulk-accountability-pdf.ts`
    - Create `utils/generate-bulk-accountability-pdf.ts`
    - Export the `BulkAccountabilityGroup` interface: `{ new_user: string; department: string; position: string; items: InventoryItem[] }`
    - Import `InventoryItem` from `components/inventory.tsx` (or duplicate the interface inline to avoid circular imports)
    - _Requirements: 7.1, 7.2_

  - [x] 1.2 Implement `groupSelectedItems` pure helper
    - Export `groupSelectedItems(items: InventoryItem[]): BulkAccountabilityGroup[]`
    - Normalise `new_user` with `.trim()` and lowercase for the grouping key
    - Items with blank/whitespace/undefined `new_user` go into the `"Unknown"` group
    - Derive `department` and `position` from the first item in each group that has a non-empty value; default to `""`
    - Return groups in the order their first item appears in the input array
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 1.3 Write property test for `groupSelectedItems` — Property 3: Grouping partitions items correctly
    - **Property 3: Grouping partitions items correctly**
    - **Validates: Requirements 3.1, 3.2, 3.4**
    - File: `utils/__tests__/generate-bulk-accountability-pdf.property.test.ts`
    - Generate random `InventoryItem[]` (length 1–50) with `new_user` drawn from a small alphabet to force collisions
    - Assert: union of all group items equals the input set; no item appears in more than one group; items with blank `new_user` are in the `"Unknown"` group

  - [ ]* 1.4 Write property test for `groupSelectedItems` — Property 4: Group metadata derives from first non-empty item
    - **Property 4: Group metadata derives from first non-empty item**
    - **Validates: Requirements 3.3**
    - File: `utils/__tests__/generate-bulk-accountability-pdf.property.test.ts`
    - Generate random `InventoryItem[]` where `department` and `position` are independently nullable
    - Assert: for each group, `group.department` equals the `department` of the first item in that group with a non-empty value, or `""`

  - [ ]* 1.5 Write unit tests for `groupSelectedItems`
    - File: `utils/__tests__/generate-bulk-accountability-pdf.test.ts`
    - Test: single item, two items same user, two items different users, item with blank `new_user` → `"Unknown"`
    - Test: `"Alice"` and `"alice"` merge into one group (case-insensitivity)
    - Test: first non-empty `department`/`position` wins; all-empty defaults to `""`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Implement column routing and `renderEmployeeForm` helper
  - [x] 2.1 Implement column-routing logic inside the utility module
    - Add an internal `routeItem(item: InventoryItem)` helper (or inline logic) that maps `asset_type` to left (Laptop/Desktop) or right (Monitor) column values
    - `"LAPTOP"` and `"DESKTOP"` → Laptop/Desktop column; `"MONITOR"` → Monitor column; all other values including null/undefined → Laptop/Desktop column as fallback
    - Left column fields: Brand/Model, Processor, RAM, Storage, OS, Serial Number, MAC Address, Date Purchase, Amount
    - Right column fields (Monitor): Brand/Model, Serial Number, Asset Tag rows; blank for non-monitor items
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.2 Write property test for column routing — Property 2: Column routing is total and correct
    - **Property 2: Column routing is total and correct**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - File: `utils/__tests__/generate-bulk-accountability-pdf.property.test.ts`
    - Generate random `InventoryItem` with `asset_type` drawn from `["LAPTOP", "DESKTOP", "MONITOR", "OTHER", null, undefined]`
    - Assert: routing assigns item to exactly one column; opposite column fields are blank

  - [ ]* 2.3 Write unit tests for column routing
    - File: `utils/__tests__/generate-bulk-accountability-pdf.test.ts`
    - Test: LAPTOP → left column populated, right blank
    - Test: DESKTOP → left column populated, right blank
    - Test: MONITOR → right column populated, left blank
    - Test: unknown/null/undefined `asset_type` → left column populated (fallback), right blank
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.4 Implement `renderEmployeeForm` internal helper
    - Mirror the section-by-section logic of `generateAccountabilityPDF` in `inventory-dialog.tsx` exactly
    - Sections in order: header (Ecoshift branding + title), Employee Information, Asset Details table (using column routing), Employee Accountability & Agreement (6 bullet clauses), Consequences of Misuse (4 items), sign-off line, Signature lines (7 fields), FOR IT DEPARTMENT ONLY section
    - Use the same layout constants: `margin = 18`, `pageW = 210`, `contentW = pageW - margin * 2`
    - Use the same column widths: col0 = `contentW * 0.22`, col1 = `contentW * 0.28`, col2 = `contentW * 0.22`, col3 = `contentW * 0.28`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.5_

  - [ ]* 2.5 Write property test for mixed-type groups — Property 7: Mixed-type groups populate both columns
    - **Property 7: Mixed-type groups populate both columns**
    - **Validates: Requirements 7.3**
    - File: `utils/__tests__/generate-bulk-accountability-pdf.property.test.ts`
    - Generate `BulkAccountabilityGroup` where `items` contains at least one laptop/desktop item and at least one monitor item
    - Assert: the rendered table body has non-blank values in both the left-value column and the right-value column

- [x] 3. Implement `generateBulkAccountabilityPDF` async function
  - [x] 3.1 Implement the main `generateBulkAccountabilityPDF` exported function
    - Export `async function generateBulkAccountabilityPDF(groups: BulkAccountabilityGroup[]): Promise<void>`
    - Return immediately if `groups` is empty (no jsPDF instance created, no `doc.save()` call)
    - Dynamically import `jsPDF` and `jspdf-autotable` (matching the pattern in `inventory-dialog.tsx`)
    - Create a single `jsPDF` document; iterate over `groups`, calling `renderEmployeeForm` for each
    - Insert `doc.addPage()` between groups (not before the first group)
    - After all groups are rendered, write `Page X of Y` footers on every page
    - Call `doc.save()` exactly once with filename `Accountability_Forms_Bulk_<YYYY-MM-DD>.pdf`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.7, 6.6, 7.1, 7.4_

  - [ ]* 3.2 Write property test for single PDF per invocation — Property 5: One PDF file produced per invocation
    - **Property 5: One PDF file produced per invocation**
    - **Validates: Requirements 4.1, 6.6**
    - File: `utils/__tests__/generate-bulk-accountability-pdf.property.test.ts`
    - Generate random `BulkAccountabilityGroup[]` (length 1–10) with valid data
    - Mock `doc.save`; assert it is called exactly once after `generateBulkAccountabilityPDF(groups)` resolves

  - [ ]* 3.3 Write property test for page numbers — Property 6: Page numbers are present on every page
    - **Property 6: Page numbers are present on every page**
    - **Validates: Requirements 5.7**
    - File: `utils/__tests__/generate-bulk-accountability-pdf.property.test.ts`
    - Generate random `BulkAccountabilityGroup[]` that produce varying page counts
    - Assert: after generation, every page in the document has a footer matching `Page X of Y` where X and Y are correct

  - [ ]* 3.4 Write unit tests for `generateBulkAccountabilityPDF`
    - File: `utils/__tests__/generate-bulk-accountability-pdf.test.ts`
    - Test: empty input → `doc.save` never called
    - Test: filename matches `/^Accountability_Forms_Bulk_\d{4}-\d{2}-\d{2}\.pdf$/`
    - Test: single group → `doc.save` called once, no `addPage` between groups
    - Test: multiple groups → `doc.addPage` called `groups.length - 1` times
    - _Requirements: 4.3, 4.4, 6.6, 7.4_

- [x] 4. Checkpoint — Ensure utility module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate the utility into `inventory.tsx`
  - [x] 5.1 Add imports and `isPdfGenerating` state to `inventory.tsx`
    - Add import: `import { generateBulkAccountabilityPDF, groupSelectedItems } from "@/utils/generate-bulk-accountability-pdf"`
    - Add state: `const [isPdfGenerating, setIsPdfGenerating] = useState(false)`
    - _Requirements: 6.2, 7.2_

  - [x] 5.2 Add `showPrintButton` derived value and `handlePrintBulk` handler
    - Compute `showPrintButton`: `selectedIds.size > 0 && [...selectedIds].some(id => { const item = activities.find(a => a.id === id); return !!item?.new_user?.trim(); })`
    - Implement `handlePrintBulk` async handler:
      - Guard: if `selectedIds.size === 0`, return early without invoking the generator
      - Collect selected items from `activities` using `selectedIds`
      - Call `groupSelectedItems(selectedItems)` to produce groups
      - If all groups have `new_user === "Unknown"` (i.e., no valid employee), call `toast.error(...)` and return
      - Set `isPdfGenerating = true`
      - `await generateBulkAccountabilityPDF(groups)` inside a try/catch
      - On error: call `toast.error("Failed to generate PDF")` and re-enable button
      - In finally: set `isPdfGenerating = false`
    - _Requirements: 4.4, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 5.3 Add the conditional "Print Accountability Form" button to the toolbar
    - Render the button only when `showPrintButton` is `true`
    - Place it in the same toolbar row as "Delete Selected", "Add New", and "Bulk Upload"
    - Button label: `isPdfGenerating ? "Generating PDF..." : "Print Accountability Form"`
    - Button `disabled` prop: `isPdfGenerating`
    - `onClick`: calls `handlePrintBulk`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.2, 6.3_

  - [ ]* 5.4 Write property test for button visibility — Property 1: Button visibility matches selection state
    - **Property 1: Button visibility matches selection state**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - File: `utils/__tests__/generate-bulk-accountability-pdf.property.test.ts`
    - Generate random `InventoryItem[]` with varying `new_user` values; random subset of IDs as `selectedIds`
    - Assert: `showPrintButton` logic returns `true` iff `selectedIds.size > 0` AND at least one selected item has a non-empty (non-whitespace) `new_user`

  - [ ]* 5.5 Write unit tests for button visibility and handler behaviour in `inventory.tsx`
    - File: `utils/__tests__/generate-bulk-accountability-pdf.test.ts`
    - Test: 0 selected → button not rendered
    - Test: 1 selected with non-empty `new_user` → button rendered
    - Test: 1 selected with blank `new_user` → button not rendered
    - Test: mock generator with delayed promise → button disabled and label is "Generating PDF..." while pending, then restored on resolution
    - Test: mock generator throws → `toast.error` called and button re-enabled
    - _Requirements: 1.1, 1.2, 1.3, 6.2, 6.3, 6.4_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- The `InventoryItem` interface may need to be extracted to `types/inventory.ts` to avoid a circular import between `inventory.tsx` and the new utility; if so, update both files accordingly

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["5.3"] },
    { "id": 7, "tasks": ["5.4", "5.5"] }
  ]
}
```
