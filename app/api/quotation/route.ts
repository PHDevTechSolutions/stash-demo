import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

// Decode common HTML entities
function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

// Parse description string (HTML or plain text) into [label, value] rows
function parseDescriptionToRows(description: string): string[][] {
  // Step 1: normalize separators
  let clean = description
    .replace(/\|\|/g, "\n") // treat || as new row
    .replace(/<br\s*\/?>/gi, "\n") // convert <br> to newline
    .replace(/<\/?[^>]+(>|$)/g, ""); // strip all HTML tags

  // Step 2: decode HTML entities
  clean = decodeEntities(clean);

  // Step 3: split by newline
  const lines = clean.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);

  // Step 4: group into [label, value] pairs
  const rows: string[][] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const label = lines[i];
    const value = lines[i + 1] || "";
    rows.push([label, value]);
  }
  return rows;
}

// Insert description table into a single cell (col=4)
function addDescriptionTable(
  sheet: ExcelJS.Worksheet,
  description: string,
  rowNumber: number,
  colNumber: number
) {
  const rows = parseDescriptionToRows(description);

  // Combine into one string with line breaks
  const combined = rows.map(r => r.join(": ")).join("\n");

  const cell = sheet.getRow(rowNumber).getCell(colNumber);
  cell.value = combined;
  cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
}

export async function POST(req: Request) {
  const data = await req.json();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Quotation");

  // Header
  sheet.addRow(["QUOTATION / SALES ORDER"]);
  sheet.addRow([]);
  sheet.addRow([`Reference No: ${data.referenceNo}`, `Date: ${data.date}`]);
  sheet.addRow([]);
  sheet.addRow([`COMPANY NAME: ${data.companyName}`]);
  sheet.addRow([`ADDRESS: ${data.address}`]);
  sheet.addRow([`TEL NO: ${data.telNo}`]);
  sheet.addRow([`EMAIL ADDRESS: ${data.email}`]);
  sheet.addRow([`ATTENTION: ${data.attention}`]);
  sheet.addRow([`SUBJECT: ${data.subject}`]);
  sheet.addRow([]);
  sheet.addRow(["We are pleased to offer you the following products for consideration:"]);
  sheet.addRow([]);

  // Table header
  sheet.addRow([
    "ITEM NO",
    "QTY",
    "REFERENCE PHOTO",
    "PRODUCT DESCRIPTION",
    "UNIT PRICE",
    "TOTAL AMOUNT",
  ]);

  // Items with images + description table
  for (const item of data.items) {
    const row = sheet.addRow([
      item.itemNo,
      item.qty,
      "", // placeholder for image
      "", // description placeholder
      item.unitPrice,
      item.totalAmount,
    ]);

    // Insert parsed description table into description column (col=4)
    addDescriptionTable(sheet, item.description, row.number, 4);

    // Image handling
    try {
      const res = await fetch(item.referencePhoto);
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const imageId = workbook.addImage({
        base64: `data:image/png;base64,${base64}`,
        extension: "png",
      });

      sheet.addImage(imageId, {
        tl: { col: 2, row: row.number - 1 },
        ext: { width: 100, height: 100 },
      });

      sheet.getRow(row.number).height = 80;
    } catch (err) {
      console.error(`Failed to load image for item ${item.itemNo}:`, err);
    }
  }

  // Footer (same as before)
  sheet.addRow([]);
  sheet.addRow([`Choose Once:  ○ ${data.vatType}    ○ (other options not selected)`]);
  sheet.addRow([]);
  sheet.addRow([`Total Price: ₱${data.totalPrice.toFixed(2)}`]);
  sheet.addRow([]);
  sheet.addRow(["DELIVERY TERMS"]);
  sheet.addRow(["Included:"]);
  sheet.addRow(["- Orders Within Metro Manila: Free delivery for a minimum sales transaction of ₱5,000."]);
  sheet.addRow(["- Orders outside Metro Manila Free delivery is available for a minimum sales transaction of:"]);
  sheet.addRow(["  ₱10,000 in Rizal,"]);
  sheet.addRow(["  ₱15,000 in Bulacan and Cavite,"]);
  sheet.addRow(["  ₱25,000 in Laguna, Pampanga, and Batangas."]);
  sheet.addRow([]);
  sheet.addRow(["Excluded:"]);
  sheet.addRow(["- All lamp poles are subject to a delivery charge."]);
  sheet.addRow(["- Installation and all hardware/accessories not indicated above."]);
  sheet.addRow(["- Freight charges, arrastre, and other processing fees."]);
  sheet.addRow([]);
  sheet.addRow(["Notes:"]);
  sheet.addRow(["- Deliveries are up to the vehicle unloading point only."]);
  sheet.addRow(["- Additional shipping fee applies for other areas not mentioned above."]);
  sheet.addRow(["- Subject to confirmation upon getting the actual weight and dimensions of the items."]);
  sheet.addRow(["- In cases of client error, there will be a 10% restocking fee for returns, refunds, and exchanges."]);
  sheet.addRow([]);
  sheet.addRow(["TERMS AND CONDITIONS"]);
  sheet.addRow(["(Refer to your detailed terms & conditions text here...)"]);
  sheet.addRow([]);
  sheet.addRow(["PAYMENT TERMS"]);
  sheet.addRow(["- Full payment due upon order confirmation."]);
  sheet.addRow(["- Partial payments or deposits must be cleared before processing."]);
  sheet.addRow(["- Payments can be made via bank transfer, check, or cash."]);
  sheet.addRow([]);
  sheet.addRow(["CANCELLATION POLICY"]);
  sheet.addRow(["- Cancellation must be made in writing."]);
  sheet.addRow(["- Orders cancelled after PO approval may incur penalties or restocking fees."]);
  sheet.addRow(["- Client error returns are subject to 10% restocking fee."]);
  sheet.addRow([]);
  sheet.addRow(["SIGNATORIES"]);
  sheet.addRow(["_________________________                _________________________"]);
  sheet.addRow(["Authorized Company Representative       Authorized Client Representative"]);
  sheet.addRow([]);
  sheet.addRow(["Date: _______________                   Date: _______________"]);

  // Column widths
  sheet.columns = [
    { width: 10 },
    { width: 5 },
    { width: 20 }, // image column
    { width: 50 }, // description
    { width: 15 },
    { width: 15 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=Quotation_${data.referenceNo}.xlsx`,
    },
  });
}