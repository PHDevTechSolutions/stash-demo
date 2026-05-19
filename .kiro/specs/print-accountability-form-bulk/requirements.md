# Requirements Document

## Introduction

This feature adds a "Print Accountability Form" button to the inventory table toolbar in `inventory.tsx`. When one or more rows are selected via the existing checkboxes, the button becomes visible. Clicking it generates and downloads a single PDF file containing one accountability form page per unique employee (`new_user`), with each employee's selected assets laid out in the standard Ecoshift Corporation accountability form structure — reusing the PDF layout already established in `generateAccountabilityPDF` inside `inventory-dialog.tsx`.

## Glossary

- **Inventory_Table**: The `Inventory` React component rendered in `inventory.tsx` that displays asset records in a paginated, filterable table.
- **Toolbar**: The action bar above the inventory table that contains buttons such as "Add New", "Bulk Upload", and "Delete Selected".
- **Selected_Items**: The set of inventory rows whose IDs are present in the `selectedIds` state (`Set<string>`).
- **PDF_Generator**: The client-side PDF generation logic built with `jsPDF` and `jspdf-autotable`.
- **Accountability_Form**: The structured PDF document containing employee information, asset details, accountability agreement, consequences of misuse, signature lines, and an IT department section.
- **Employee_Group**: A collection of Selected_Items that share the same `new_user` value.
- **Laptop_Desktop_Column**: The left column group in the asset details table of the Accountability_Form, used for assets whose `asset_type` is `DESKTOP` or `LAPTOP`.
- **Monitor_Column**: The right column group in the asset details table of the Accountability_Form, used for assets whose `asset_type` is `MONITOR`.
- **InventoryItem**: The TypeScript interface representing a single inventory record, including fields: `id`, `asset_tag`, `asset_type`, `status`, `new_user`, `department`, `position`, `brand`, `model`, `processor`, `ram`, `storage`, `serial_number`, `purchase_date`, `amount`, `remarks`, `mac_address`.
- **BulkAccountabilityGroup**: A data structure of shape `{ new_user: string; department: string; position: string; items: InventoryItem[] }` representing one employee's form data.

---

## Requirements

### Requirement 1: Print Accountability Form Button Visibility

**User Story:** As an IT staff member, I want the "Print Accountability Form" button to appear only when I have selected items, so that the toolbar remains uncluttered when no selection is active.

#### Acceptance Criteria

1. IF the number of selected items is greater than zero AND at least one selected item has a `new_user` value containing at least one character, THEN the Inventory_Table SHALL render a "Print Accountability Form" button in the Toolbar.
2. IF the number of selected items equals zero, THEN the Inventory_Table SHALL NOT render the "Print Accountability Form" button.
3. IF all selected items have a blank (empty string or absent) `new_user` value, THEN the Inventory_Table SHALL NOT render the "Print Accountability Form" button.
4. THE Inventory_Table SHALL place the "Print Accountability Form" button in the same Toolbar row as the "Delete Selected", "Add New", and "Bulk Upload" buttons.

---

### Requirement 2: Asset Type Routing into Form Columns

**User Story:** As an IT staff member, I want each asset to appear in the correct column of the accountability form based on its type, so that the form accurately reflects the asset category.

#### Acceptance Criteria

1. WHEN an InventoryItem has `asset_type` equal to `DESKTOP` or `LAPTOP`, THE PDF_Generator SHALL place that item's Brand/Model, Processor, RAM, Storage, Serial Number, MAC Address, Purchase Date, and Amount into the Laptop_Desktop_Column of the asset details table, and SHALL leave the Monitor_Column fields blank for that row set.
2. WHEN an InventoryItem has `asset_type` equal to `MONITOR`, THE PDF_Generator SHALL place that item's Brand/Model and Serial Number into the Monitor_Column of the asset details table, and SHALL leave the Laptop_Desktop_Column fields blank for that row set.
3. IF an InventoryItem has an `asset_type` that is null, undefined, or a value other than `DESKTOP`, `LAPTOP`, or `MONITOR`, THEN THE PDF_Generator SHALL place that item's data into the Laptop_Desktop_Column as a fallback, and SHALL leave the Monitor_Column fields blank.

---

### Requirement 3: Grouping Selected Items by Employee

**User Story:** As an IT staff member, I want selected items grouped by employee name, so that each employee receives their own dedicated accountability form page.

#### Acceptance Criteria

1. THE PDF_Generator SHALL group Selected_Items by their `new_user` field value using case-insensitive comparison to produce one BulkAccountabilityGroup per unique `new_user`.
2. WHEN multiple InventoryItems share the same `new_user` value (case-insensitively), THE PDF_Generator SHALL include all of those items in a single BulkAccountabilityGroup.
3. THE PDF_Generator SHALL derive the `department` and `position` fields for each BulkAccountabilityGroup from the first InventoryItem (in Selected_Items array order) in that group that has a non-empty value for those fields; if no item in the group has a non-empty value, the field SHALL default to an empty string.
4. WHEN a Selected_Item has an empty, whitespace-only, or undefined `new_user` value, THE PDF_Generator SHALL group that item under the label `"Unknown"`.

---

### Requirement 4: Single PDF with Per-Employee Pages

**User Story:** As an IT staff member, I want all employee forms combined into one downloaded PDF file, so that I can print or share the entire batch in a single action.

#### Acceptance Criteria

1. THE PDF_Generator SHALL produce a single PDF file where each BulkAccountabilityGroup occupies its own complete form section, beginning on a new page, containing all employee information, asset details, agreement, consequences, signature lines, and IT department sections.
2. WHEN more than one BulkAccountabilityGroup exists, THE PDF_Generator SHALL insert a page break between each employee's Accountability_Form section so that each employee's form starts at the top of a new page.
3. THE PDF_Generator SHALL name the downloaded file `Accountability_Forms_Bulk_<ISO-date>.pdf`, where `<ISO-date>` is the current date in `YYYY-MM-DD` format.
4. WHEN the user clicks the "Print Accountability Form" button, THE PDF_Generator SHALL be invoked with the BulkAccountabilityGroups derived from the currently selected items.
5. IF no BulkAccountabilityGroups are available (e.g., all selected items have blank `new_user`), THEN THE PDF_Generator SHALL NOT produce a file and the Inventory_Table SHALL display a toast error notification.

---

### Requirement 5: Accountability Form Page Structure

**User Story:** As an IT staff member, I want each employee's form page to follow the established Ecoshift Corporation accountability form layout, so that the output is consistent with existing single-item forms.

#### Acceptance Criteria

1. THE PDF_Generator SHALL render an "EMPLOYEE INFORMATION" section containing the employee's name (`new_user`), department, and position for each BulkAccountabilityGroup.
2. THE PDF_Generator SHALL render an "ASSET DETAILS" table with a Laptop_Desktop_Column group on the left (rows: Brand/Model, Processor, RAM, Storage, OS, Serial Number, MAC Address, Date Purchase, Amount) and a Monitor_Column group on the right (rows: Brand/Model, Serial Number, Asset Tag, Brand/Model, Serial Number, Asset Tag, blank, blank, Amount) for each BulkAccountabilityGroup, followed by an Inclusion/Remarks row spanning all columns.
3. THE PDF_Generator SHALL render an "EMPLOYEE ACCOUNTABILITY & AGREEMENT" section containing exactly 6 bullet-point clauses covering: proper use and safekeeping, prohibition on lending/transferring/modifying, reporting of loss/theft/damage within 24 hours, return of asset upon separation or request, company ownership of the asset, and disciplinary consequences for non-compliance.
4. THE PDF_Generator SHALL render a "CONSEQUENCES OF MISUSE, LOSS OR DAMAGE" section containing exactly 4 consequence items covering: accidental damage, damage due to negligence, failure to report damage, and non-return or unserviceable return of asset.
5. THE PDF_Generator SHALL render signature lines for: Employee Name, Employee Signature, Date (after employee signature), IT Representative Signature, Date (after IT representative), Department Head / IT Supervisor, and Date (after department head).
6. THE PDF_Generator SHALL render a "FOR IT DEPARTMENT ONLY" section with asset status checkboxes labeled "Deployed", "Returned", "Reassigned", "Decommissioned"; a return date line; condition checkboxes labeled "Good", "With Issues", "Damaged", "Missing Items"; and a remarks line.
7. THE PDF_Generator SHALL include page numbers in the format `Page X of Y` at the bottom-right of every page in the PDF.

---

### Requirement 6: Bulk PDF Generation Trigger

**User Story:** As an IT staff member, I want clicking the "Print Accountability Form" button to immediately start generating and downloading the PDF, so that I can complete the task without additional dialogs.

#### Acceptance Criteria

1. WHEN the user clicks the "Print Accountability Form" button, THE Inventory_Table SHALL invoke the PDF_Generator with the array of BulkAccountabilityGroups derived from the Selected_Items.
2. WHILE the PDF_Generator is running, THE Inventory_Table SHALL display the "Print Accountability Form" button in a disabled state with the label "Generating PDF..." to prevent duplicate submissions.
3. WHEN the PDF_Generator completes successfully, THE Inventory_Table SHALL re-enable the "Print Accountability Form" button and restore its label to "Print Accountability Form".
4. IF the PDF_Generator throws an error, THEN THE Inventory_Table SHALL display a toast error notification describing the failure and re-enable the "Print Accountability Form" button.
5. IF the number of selected items is zero when the button is clicked, THEN THE Inventory_Table SHALL NOT invoke the PDF_Generator.
6. THE PDF_Generator SHALL produce exactly one PDF file per invocation, regardless of the number of BulkAccountabilityGroups.

---

### Requirement 7: Reuse of Existing PDF Layout Logic

**User Story:** As a developer, I want the bulk PDF generator to reuse the existing single-item PDF layout, so that the two outputs remain visually consistent and maintenance is minimised.

#### Acceptance Criteria

1. THE PDF_Generator SHALL be implemented as a standalone exported async function named `generateBulkAccountabilityPDF` that accepts a parameter of type `BulkAccountabilityGroup[]`, where `BulkAccountabilityGroup` is defined as `{ new_user: string; department: string; position: string; items: InventoryItem[] }`.
2. THE `generateBulkAccountabilityPDF` function SHALL be placed in a separate module (e.g., `utils/generate-bulk-accountability-pdf.ts`) so that it can be imported by `inventory.tsx` without creating a circular dependency with `inventory-dialog.tsx`.
3. WHEN a BulkAccountabilityGroup contains both Laptop_Desktop_Column items and Monitor_Column items, THE PDF_Generator SHALL populate both column groups in the same asset details table row set on a single form page for that employee.
4. WHEN `generateBulkAccountabilityPDF` is called with an empty array, THE PDF_Generator SHALL return without producing or downloading any file.
5. THE layout of each employee's form page produced by `generateBulkAccountabilityPDF` SHALL match the layout produced by `generateAccountabilityPDF` in `inventory-dialog.tsx`, including section order, font sizes, line spacing, table column widths, and page margin values.
