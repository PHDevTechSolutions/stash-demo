/**
 * Bulk Accountability Form PDF Generator
 *
 * Standalone utility module for generating a single PDF containing one
 * accountability form page per unique employee from a set of selected
 * inventory items. Reuses the exact layout from `generateAccountabilityPDF`
 * in `components/inventory-dialog.tsx`.
 *
 * Placed in a separate module to avoid circular dependencies between
 * `inventory.tsx`, `inventory-dialog.tsx`, and this utility.
 */

import { type InventoryItem } from "@/types/inventory";

// Re-export InventoryItem so consumers of this module can use it directly
export type { InventoryItem };

/**
 * Represents one employee's grouped accountability form data.
 * Each group maps to exactly one form page in the bulk PDF.
 */
export interface BulkAccountabilityGroup {
    /** The employee's name (normalised from `new_user`). `"Unknown"` for items with blank/undefined `new_user`. */
    new_user: string;
    /** Department derived from the first item in the group with a non-empty value; defaults to `""`. */
    department: string;
    /** Position derived from the first item in the group with a non-empty value; defaults to `""`. */
    position: string;
    /** All inventory items belonging to this employee. */
    items: InventoryItem[];
}

/**
 * Groups an array of inventory items by employee (`new_user`), producing one
 * `BulkAccountabilityGroup` per unique employee.
 *
 * Grouping rules:
 * - `new_user` is trimmed and lowercased to form the comparison key so that
 *   `"Alice"`, `"alice"`, and `"  ALICE  "` all map to the same group.
 * - Items whose `new_user` is blank, whitespace-only, or `undefined` are
 *   placed in the `"Unknown"` group.
 * - The display name (`new_user` on the returned group) is the trimmed
 *   original value from the **first** item in the group, preserving the
 *   original casing. For the unknown group the display name is `"Unknown"`.
 * - `department` and `position` are taken from the first item (in input
 *   array order) within the group that has a non-empty value for each field;
 *   they default to `""` if no such item exists.
 * - Groups are returned in the order their first item appears in the input
 *   array.
 *
 * @param items - The selected inventory items to group.
 * @returns An ordered array of `BulkAccountabilityGroup` values.
 */
export function groupSelectedItems(items: InventoryItem[]): BulkAccountabilityGroup[] {
    // Maintain insertion order via a Map keyed by the normalised (lowercase) user name.
    const groupMap = new Map<string, BulkAccountabilityGroup>();

    for (const item of items) {
        const trimmed = item.new_user?.trim() ?? "";
        const isUnknown = trimmed === "";
        const key = isUnknown ? "unknown" : trimmed.toLowerCase();
        const displayName = isUnknown ? "Unknown" : trimmed;

        if (!groupMap.has(key)) {
            // Initialise the group with empty metadata; we'll fill it below.
            groupMap.set(key, {
                new_user: displayName,
                department: "",
                position: "",
                items: [],
            });
        }

        const group = groupMap.get(key)!;
        group.items.push(item);

        // Update department from the first item in the group that has a non-empty value.
        if (group.department === "" && item.department?.trim()) {
            group.department = item.department.trim();
        }

        // Update position from the first item in the group that has a non-empty value.
        if (group.position === "" && item.position?.trim()) {
            group.position = item.position.trim();
        }
    }

    return Array.from(groupMap.values());
}

// ─── Column Routing ───────────────────────────────────────────────────────────

/**
 * The structured output of `routeItem`, representing the two column groups
 * in the asset details table of the accountability form.
 *
 * Each side is an array of 9 `[label, value]` pairs corresponding to the
 * fixed row structure defined in the design document:
 *
 * | Row | Left label    | Right label        |
 * |-----|---------------|--------------------|
 * |  0  | Brand / Model | Brand / Model      |
 * |  1  | Processor     | Serial Number      |
 * |  2  | RAM           | Asset Tag          |
 * |  3  | Storage       | Brand / Model      |
 * |  4  | OS            | Serial Number      |
 * |  5  | Serial Number | Asset Tag          |
 * |  6  | Mac Address   | (blank)            |
 * |  7  | Date Purchase | (blank)            |
 * |  8  | Amount        | Amount             |
 */
export interface RoutedItemColumns {
    /** Left column (Laptop / Desktop) — 9 [label, value] pairs. */
    left: [string, string][];
    /** Right column (Monitor) — 9 [label, value] pairs. */
    right: [string, string][];
}

/**
 * Routes an `InventoryItem` into the correct column of the asset details
 * table based on its `asset_type`.
 *
 * Routing rules:
 * - `"LAPTOP"` or `"DESKTOP"` → Laptop/Desktop column (left); Monitor column (right) is blank.
 * - `"MONITOR"` → Monitor column (right); Laptop/Desktop column (left) is blank.
 * - Any other value, `null`, or `undefined` → Laptop/Desktop column (left) as fallback; right is blank.
 *
 * The returned arrays have exactly 9 entries each, matching the fixed row
 * structure of the accountability form table (rows 0–8; row 9 is the
 * Inclusion/Remarks row handled separately).
 *
 * @param item - The inventory item to route.
 * @returns A `RoutedItemColumns` object with populated `left` and `right` arrays.
 */
export function routeItem(item: InventoryItem): RoutedItemColumns {
    const assetType = item.asset_type?.toUpperCase();

    const brandModel = `${item.brand ?? ""} ${item.model ?? ""}`.trim();
    const amount = item.amount
        ? Number(item.amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";

    if (assetType === "MONITOR") {
        // Monitor items populate the right column; left column is blank.
        const left: [string, string][] = [
            ["Brand / Model",  ""],
            ["Processor",      ""],
            ["RAM",            ""],
            ["Storage",        ""],
            ["OS",             ""],
            ["Serial Number",  ""],
            ["Mac Address",    ""],
            ["Date Purchase",  ""],
            ["Amount",         ""],
        ];

        const right: [string, string][] = [
            ["Brand / Model",  brandModel],
            ["Serial Number",  item.serial_number ?? ""],
            ["Asset Tag",      item.asset_tag ?? ""],
            ["Brand / Model",  ""],
            ["Serial Number",  ""],
            ["Asset Tag",      ""],
            ["",               ""],
            ["",               ""],
            ["Amount",         amount],
        ];

        return { left, right };
    }

    // LAPTOP, DESKTOP, or any fallback → left column populated, right blank.
    const left: [string, string][] = [
        ["Brand / Model",  brandModel],
        ["Processor",      item.processor ?? ""],
        ["RAM",            item.ram ?? ""],
        ["Storage",        item.storage ?? ""],
        ["OS",             ""],
        ["Serial Number",  item.serial_number ?? ""],
        ["Mac Address",    item.mac_address ?? ""],
        ["Date Purchase",  item.purchase_date ?? ""],
        ["Amount",         amount],
    ];

    const right: [string, string][] = [
        ["Brand / Model",  ""],
        ["Serial Number",  ""],
        ["Asset Tag",      ""],
        ["Brand / Model",  ""],
        ["Serial Number",  ""],
        ["Asset Tag",      ""],
        ["",               ""],
        ["",               ""],
        ["Amount",         ""],
    ];

    return { left, right };
}

// ─── renderEmployeeForm ───────────────────────────────────────────────────────

/**
 * Renders one employee's complete accountability form onto the current page of
 * `doc`, starting at `startY`. Mirrors `generateAccountabilityPDF` in
 * `inventory-dialog.tsx` section by section.
 *
 * This is an internal helper — it does NOT call `doc.save()` or `doc.addPage()`.
 *
 * @param doc       - The jsPDF document instance.
 * @param autoTable - The jspdf-autotable function (passed in from the async caller).
 * @param group     - The employee group whose form is being rendered.
 * @param startY    - The Y position (mm) at which to begin drawing.
 */
export function renderEmployeeForm(
    doc: any,
    autoTable: (doc: any, options: any) => void,
    group: BulkAccountabilityGroup,
    startY: number,
    logoDataUrl?: string,
    company?: "ecoshift" | "disruptive"
): void {
    const pageW    = 210;
    const margin   = 18;
    const contentW = pageW - margin * 2;

    // ── Helpers ──────────────────────────────────────────────────────────────
    const line = (y: number) => {
        doc.setDrawColor(0);
        doc.setLineWidth(0.4);
        doc.line(margin, y, pageW - margin, y);
    };

    // ── Header: logo image OR text fallback ───────────────────────────────────
    if (logoDataUrl) {
        // Center the logo above the title — 70mm wide, 28mm tall
        const logoW = 100;
        const logoH = 28;
        const logoX = (pageW - logoW) / 2;
        try {
            doc.addImage(logoDataUrl, "PNG", logoX, startY - 4, logoW, logoH);
        } catch {
            // fall back to text if image fails
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(company === "disruptive" ? "DISRUPTIVE" : "ECOSHIFT CORPORATION", pageW / 2, startY + 8, { align: "center" });
        }
    } else {
        // Text fallback
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("ECOSHIFT CORPORATION", margin, startY);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text('"THE BRIGHT CHOICE!"', margin, startY + 4);
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("ACCOUNTABILITY FORM", pageW / 2, startY + 30, { align: "center" });

    line(startY + 35);

    // ── Employee Information ──────────────────────────────────────────────────
    let y = startY + 42;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE INFORMATION", margin, y);
    y += 6;

    const empFields: [string, string][] = [
        ["Employee Name:", group.new_user   || ""],
        ["Employee ID:",   ""],
        ["Department:",    group.department || ""],
        ["Position:",      group.position   || ""],
    ];

    doc.setFontSize(9);
    empFields.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, margin, y);
        doc.setFont("helvetica", "normal");
        const labelW = doc.getTextWidth(label) + 3;
        doc.text(value, margin + labelW, y);
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.line(margin + labelW, y + 0.8, margin + labelW + 72, y + 0.8);
        y += 6;
    });

    line(y + 1);
    y += 6;

    // ── Asset Details ─────────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("ASSET DETAILS", margin, y);
    y += 4;

    // Split items into left-column (laptop/desktop) and right-column (monitor) buckets.
    // Then pair them up: each pair shares one 9-row block + 1 inclusion row.
    // If one bucket is longer than the other, the extra items are paired with an empty slot.
    const leftItems  = group.items.filter(i => i.asset_type?.toUpperCase() !== "MONITOR");
    const rightItems = group.items.filter(i => i.asset_type?.toUpperCase() === "MONITOR");
    const pairCount  = Math.max(leftItems.length, rightItems.length, 1);

    const tableBody: any[] = [];

    for (let p = 0; p < pairCount; p++) {
        const leftItem  = leftItems[p]  ?? null;
        const rightItem = rightItems[p] ?? null;

        // Build 9 data rows for this pair
        const leftData  = leftItem  ? routeItem(leftItem).left   : Array(9).fill(["", ""] as [string, string]);
        const rightData = rightItem ? routeItem(rightItem).right : Array(9).fill(["", ""] as [string, string]);

        leftData.forEach(([lLabel, lVal]: [string, string], i: number) => {
            const [rLabel, rVal] = rightData[i] as [string, string];
            tableBody.push([
                { content: lLabel, styles: { fontStyle: "bold" as const, fontSize: 8 } },
                { content: lVal,   styles: { fontSize: 8 } },
                { content: rLabel, styles: { fontStyle: "bold" as const, fontSize: 8 } },
                { content: rVal,   styles: { fontSize: 8 } },
            ]);
        });

        // Inclusion / Remarks row — show whichever item has remarks (prefer left)
        const inclusionText = (leftItem?.remarks || rightItem?.remarks || "");
        tableBody.push([
            {
                content: "Inclusion:",
                styles: { fontStyle: "bold" as const, fontSize: 8 },
            },
            {
                content: inclusionText,
                colSpan: 3,
                styles: { fontSize: 8, minCellHeight: 18 },
            } as any,
            {} as any,
            {} as any,
        ]);
    }

    autoTable(doc, {
        startY: y + 1,
        head: [[
            { content: "Laptop / Desktop", colSpan: 2, styles: { halign: "center", fontStyle: "bold", fontSize: 8.5, fillColor: [255, 255, 255], textColor: [0, 0, 0] } },
            { content: "Monitor",          colSpan: 2, styles: { halign: "center", fontStyle: "bold", fontSize: 8.5, fillColor: [255, 255, 255], textColor: [0, 0, 0] } },
        ]],
        body: tableBody,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.3 },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", lineColor: [0, 0, 0], lineWidth: 0.35 },
        columnStyles: {
            0: { cellWidth: contentW * 0.22 },
            1: { cellWidth: contentW * 0.28 },
            2: { cellWidth: contentW * 0.22 },
            3: { cellWidth: contentW * 0.28 },
        },
        margin: { left: margin, right: margin },
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 4;

    line(y);
    y += 6;

    // ── Employee Accountability & Agreement ───────────────────────────────────
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("EMPLOYEE ACCOUNTABILITY & AGREEMENT", margin, y);
    y += 5;

    doc.setFont("helvetica", "bold");
    const intro = "I acknowledge receipt of the IT asset listed above and confirm that it is in good working condition unless otherwise stated. I understand and agree that:";
    const introLines = doc.splitTextToSize(intro, contentW);
    doc.text(introLines, margin, y);
    y += introLines.length * 4.2 + 2;

    const bullets = [
        "I am responsible for the proper use, care and safekeeping of the asset and shall use it strictly for official company business.",
        "I will not lend, transfer, sell, modify or allow unauthorized use of the asset",
        "I will immediately report any loss, theft, or damage to the IT Department and my immediate supervisor within 24 hours.",
        "I will return the asset upon request, resignation, termination or end of assignment, as part of clearance procedures.",
        "The asset remains company property at all times, in accordance with company policy.",
        "I understand that noncompliance with this agreement could result in disciplinary action in line with company policy.",
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    bullets.forEach((b) => {
        const wrapped = doc.splitTextToSize(`• ${b}`, contentW - 4);
        if (y + wrapped.length * 4 > 268) {
            doc.addPage();
            y = 20;
        }
        doc.text(wrapped, margin + 3, y);
        y += wrapped.length * 4 + 1;
    });

    y += 2;
    line(y);
    y += 5;

    // ── Consequences of Misuse ────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("CONSEQUENCES OF MISUSE, LOSS OR DAMAGE", margin, y);
    y += 5;

    const consequences = [
        { title: "Damage Asset (Accident):",           body: "The incident must be reported immediately. The IT Department will assess the damage. Repair or replacement, if any, will be handled in accordance with company policy, with no disciplinary action if no negligence is established." },
        { title: "Damage due to Negligence:",          body: "If damage results from carelessness or failure to observe proper handling procedures, the employee may be required to shoulder reasonable repair or replacement costs, subject to due process and written notice." },
        { title: "Failure to Report Damage:",          body: "Delayed or non-reporting of damaged assets may be treated as a policy violation and may lead to disciplinary action." },
        { title: "Non-Return or Unserviceable Return of Asset:", body: "Failure to return company assets, or returning them in an unserviceable condition without valid justification, may result in clearance delays and lawful recovery of costs as permitted by company policy and labor regulations." },
    ];

    doc.setFontSize(8.5);
    consequences.forEach(({ title, body }) => {
        if (y + 12 > 272) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        const lines = doc.splitTextToSize(`• ${title} `, contentW - 4);
        doc.text(lines, margin + 2, y);
        y += lines.length * 4;
        doc.setFont("helvetica", "normal");
        const bodyLines = doc.splitTextToSize(body, contentW - 8);
        if (y + bodyLines.length * 4 > 272) { doc.addPage(); y = 20; }
        doc.text(bodyLines, margin + 6, y);
        y += bodyLines.length * 4 + 2;
    });

    // ── Sign-off line ─────────────────────────────────────────────────────────
    y += 2;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const signOff = "By signing this form, I confirm that I have read, understood, and agreed to the terms stated above.";
    doc.text(doc.splitTextToSize(signOff, contentW), margin, y);
    y += 8;

    // ── Signature lines (7 fields) ────────────────────────────────────────────
    const sigLineLen = 64;
    const sigFields: [string, string][] = [
        ["Employee Name:",                    group.new_user || ""],
        ["Employee Signature:",               ""],
        ["Date:",                             ""],
        ["IT Representative Signature:",      ""],
        ["Date:",                             ""],
        ["Department Head / IT Supervisor:",  ""],
        ["Date:",                             ""],
    ];

    doc.setFontSize(8.5);
    sigFields.forEach(([label, prefill]) => {
        if (y + 6 > 275) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "normal");
        doc.text(label, margin, y);
        const lw = doc.getTextWidth(label) + 3;
        if (prefill) {
            doc.setFont("helvetica", "normal");
            doc.text(prefill, margin + lw, y);
        }
        doc.setLineWidth(0.3);
        doc.line(margin + lw, y + 0.8, margin + lw + sigLineLen, y + 0.8);
        y += 6;
    });

    y += 4;
    line(y);
    y += 5;

    // ── FOR IT DEPARTMENT ONLY ────────────────────────────────────────────────
    if (y + 40 > 280) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("FOR IT DEPARTMENT ONLY", margin, y);
    y += 5;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");

    // Asset Status checkboxes
    const statuses = ["Deployed", "Returned", "Reassigned", "Decommissioned"];
    doc.text("Asset Status:", margin, y);
    let cx = margin + doc.getTextWidth("Asset Status:") + 4;
    statuses.forEach((s) => {
        doc.rect(cx, y - 3.2, 3.5, 3.5);
        doc.text(s, cx + 5, y);
        cx += 5 + doc.getTextWidth(s) + 6;
    });
    y += 6;

    doc.text("Return Date:", margin, y);
    doc.line(
        margin + doc.getTextWidth("Return Date:") + 3,
        y + 0.8,
        margin + doc.getTextWidth("Return Date:") + 55,
        y + 0.8
    );
    y += 6;

    // Condition checkboxes
    const conditions = ["Good", "With Issues", "Damaged", "Missing Items"];
    doc.text("Condition:", margin, y);
    cx = margin + doc.getTextWidth("Condition:") + 4;
    conditions.forEach((c) => {
        doc.rect(cx, y - 3.2, 3.5, 3.5);
        doc.text(c, cx + 5, y);
        cx += 5 + doc.getTextWidth(c) + 6;
    });
    y += 6;

    doc.text("Remarks:", margin, y);
    doc.line(
        margin + doc.getTextWidth("Remarks:") + 3,
        y + 0.8,
        margin + doc.getTextWidth("Remarks:") + 80,
        y + 0.8
    );
}

// ─── generateBulkAccountabilityPDF ───────────────────────────────────────────

/**
 * Generates and downloads a single PDF file containing one accountability form
 * page per employee group.
 *
 * - Returns immediately (no file produced) if `groups` is empty.
 * - Dynamically imports jsPDF and jspdf-autotable to keep the initial bundle lean.
 * - Each group is rendered on its own page; `doc.addPage()` is inserted between
 *   groups (not before the first).
 * - After all groups are rendered, `Page X of Y` footers are written on every page.
 * - `doc.save()` is called exactly once with the filename
 *   `Accountability_Forms_Bulk_<YYYY-MM-DD>.pdf`.
 *
 * @param groups - The employee groups to render. One form page per group.
 */
export async function generateBulkAccountabilityPDF(
    groups: BulkAccountabilityGroup[],
    company: "ecoshift" | "disruptive" = "ecoshift"
): Promise<void> {
    // Requirement 7.4 / 4.4: return immediately for empty input.
    if (groups.length === 0) {
        return;
    }

    // Dynamic imports — matching the pattern in `inventory-dialog.tsx`.
    const { jsPDF }  = await import("jspdf");
    const autoTable  = (await import("jspdf-autotable")).default;

    // Fetch the company logo and convert to a data URL for jsPDF.
    let logoDataUrl: string | undefined;
    try {
        const imgPath = company === "disruptive" ? "/disruptive.png" : "/ecoshift.png";
        const res = await fetch(imgPath);
        if (res.ok) {
            const blob = await res.blob();
            logoDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload  = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
    } catch {
        // Logo fetch failed — renderEmployeeForm will fall back to text
    }

    // Create a single jsPDF document (A4 portrait).
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Render each group onto its own page.
    for (let i = 0; i < groups.length; i++) {
        // Insert a page break between groups (not before the first).
        if (i > 0) {
            doc.addPage();
        }

        // Each group starts at the top of its page (startY = 20 mm top margin).
        renderEmployeeForm(doc, autoTable, groups[i], 20, logoDataUrl, company);
    }

    // Write "Page X of Y" footers on every page (Requirement 5.7).
    const pageW      = 210;
    const margin     = 18;
    const totalPages = doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageW - margin,
            doc.internal.pageSize.getHeight() - 8,
            { align: "right" }
        );
        doc.setTextColor(0);
    }

    // Save exactly once (Requirement 4.3, 6.6).
    const isoDate  = new Date().toISOString().slice(0, 10);
    const filename = `Accountability_Forms_Bulk_${isoDate}.pdf`;
    doc.save(filename);
}
