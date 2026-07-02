"use client";

/**
 * components/vault-import-dialog.tsx
 * Import credentials from JSON or CSV with preview before confirmation.
 */

import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Upload, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (format: "json" | "csv", content: string) => Promise<void>;
  loading?: boolean;
}

interface PreviewRow {
  service_name?: string;
  username?: string;
  department?: string;
  tags?: string | string[];
  review_date?: string;
  [key: string]: unknown;
}

export function VaultImportDialog({ open, onClose, onImport, loading }: Props) {
  const [format, setFormat] = useState<"json" | "csv">("csv");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function reset() {
    setContent("");
    setPreview([]);
    setParseError("");
    setConfirmed(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const detectedFmt = file.name.endsWith(".json") ? "json" : "csv";
    setFormat(detectedFmt);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setContent(text);
      buildPreview(detectedFmt, text);
    };
    reader.readAsText(file);
    // reset input so the same file can be re-selected
    e.target.value = "";
  }

  function buildPreview(fmt: "json" | "csv", text: string) {
    setParseError("");
    setPreview([]);
    try {
      if (fmt === "json") {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error("JSON must be an array of objects.");
        setPreview(parsed.slice(0, 10));
      } else {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error("CSV has no data rows.");
        const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
        const rows = lines.slice(1, 11).map((line) => {
          const vals = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
          return obj;
        });
        setPreview(rows);
      }
    } catch (err: any) {
      setParseError(err.message || "Parse error.");
    }
  }

  async function handleConfirm() {
    if (!content) return;
    await onImport(format, content);
    reset();
  }

  const borderColor = "rgba(255,255,255,0.1)";
  const dimText = { color: "rgba(255,255,255,0.35)" };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="font-mono max-w-2xl border"
        style={{ backgroundColor: "#0d1117", borderColor }}
      >
        <DialogHeader>
          <DialogTitle className="text-white text-sm uppercase tracking-widest flex items-center gap-2">
            <Upload className="h-4 w-4" style={{ color: "#34d399" }} />
            Import Credentials
          </DialogTitle>
          <DialogDescription className="text-[10px]" style={dimText}>
            Upload a JSON or CSV file. All rows will be validated before import. Passwords will be encrypted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* File upload */}
          <label
            className="flex flex-col items-center justify-center gap-2 border border-dashed p-6 cursor-pointer transition-all hover:brightness-125"
            style={{ borderColor: "rgba(52,211,153,0.3)", backgroundColor: "rgba(52,211,153,0.04)" }}
          >
            <Upload className="h-6 w-6" style={{ color: "rgba(52,211,153,0.6)" }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
              Click to select JSON or CSV file
            </span>
            <input type="file" accept=".json,.csv" className="hidden" onChange={handleFileChange} />
          </label>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-center gap-2 px-3 py-2 border text-[10px]"
              style={{ borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.06)", color: "#fca5a5" }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {parseError}
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && !parseError && (
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-2" style={dimText}>
                Preview (first {preview.length} rows — passwords masked)
              </p>
              <div className="overflow-x-auto border" style={{ borderColor }}>
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                      {["service_name", "username", "password", "department", "tags"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[9px] uppercase tracking-widest"
                          style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          {String(row.service_name ?? "—")}
                        </td>
                        <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          {String(row.username ?? "—")}
                        </td>
                        <td className="px-3 py-2 font-mono" style={{ color: "rgba(255,255,255,0.25)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          ••••••••
                        </td>
                        <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          {String(row.department ?? "—")}
                        </td>
                        <td className="px-3 py-2" style={{ color: "rgba(255,255,255,0.65)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          {Array.isArray(row.tags) ? row.tags.join(", ") : String(row.tags ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirm checkbox */}
              <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="accent-emerald-400" />
                <span className="text-[10px] uppercase tracking-widest" style={dimText}>
                  I understand passwords will be encrypted and stored.
                </span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <button onClick={handleClose} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono"
            style={{ color: "rgba(255,255,255,0.4)", borderColor }}>
            CANCEL
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !content || !!parseError || !confirmed}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "rgba(52,211,153,0.15)", borderColor: "rgba(52,211,153,0.4)", color: "#34d399" }}
          >
            {loading ? "IMPORTING..." : "IMPORT"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
