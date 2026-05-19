"use client";

import React from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
    SheetClose,
} from "@/components/ui/sheet";
import { SlidersHorizontal, X } from "lucide-react";

type InventoryFilters = {
    status: string;
    location: string;
    asset_type: string;
    department: string;
    brand: string;
    model: string;
    processor: string;
    storage: string;
    pageSize: string;
};

type FilterKeys = keyof InventoryFilters;

interface InventoryFilterDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    filters: InventoryFilters;
    resetFilters: () => void;
    applyFilters: () => void;
    setFilters: React.Dispatch<React.SetStateAction<InventoryFilters>>;
}

const filterFields: { label: string; name: FilterKeys; options: string[] }[] = [
    {
        label: "Status", name: "status",
        options: ["Spare", "Deployed", "Lend", "Missing", "Defective", "Dispose"],
    },
    {
        label: "Location", name: "location",
        options: ["J&L", "Primex", "Pasig WH", "CDO", "Cebu", "Davao", "Buildchem", "Disruptive"],
    },
    {
        label: "Asset Type", name: "asset_type",
        options: ["Laptop", "Desktop", "Monitor"],
    },
    {
        label: "Department", name: "department",
        options: ["Information Technology", "Human Resources", "Marketing", "Sales", "Accounting", "Procurement", "Admin", "Warehouse Operations", "Engineering", "Customer Service", "Ecommerce", "Product Development"],
    },
];

const pageSizeOptions = ["10", "25", "50", "100", "250", "500", "1000"];

const termBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer disabled:opacity-40";

const selectStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.65)",
    outline: "none",
    appearance: "none" as const,
};

export function InventoryFilterDialog({
    open,
    setOpen,
    filters,
    resetFilters,
    applyFilters,
    setFilters,
}: InventoryFilterDialogProps) {
    const activeCount = Object.entries(filters).filter(
        ([k, v]) => k !== "pageSize" && v !== ""
    ).length;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <button
                    className={termBtn}
                    style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}
                >
                    <SlidersHorizontal className="h-3 w-3" />
                    FILTER
                    {activeCount > 0 && (
                        <span
                            className="px-1.5 py-0.5 text-[8px] border font-mono"
                            style={{ color: "#fb923c", borderColor: "rgba(251,146,60,0.3)", backgroundColor: "rgba(251,146,60,0.08)" }}
                        >
                            {activeCount}
                        </span>
                    )}
                </button>
            </SheetTrigger>

            <SheetContent
                side="left"
                className="w-[300px] p-0 border-r font-mono flex flex-col"
                style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.07)" }}
            >
                {/* Header */}
                <SheetHeader
                    className="px-4 py-3 border-b flex-row items-center justify-between"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: "#fb923c", boxShadow: "0 0 5px #fb923c" }}
                        />
                        <SheetTitle className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono" style={{ color: "#fb923c" }}>
                            FILTER INVENTORY
                        </SheetTitle>
                    </div>
                    <SheetClose asChild>
                        <button
                            className="transition-opacity hover:opacity-70"
                            style={{ color: "rgba(255,255,255,0.3)" }}
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </SheetClose>
                    <SheetDescription className="sr-only">
                        Filter inventory items and control page length.
                    </SheetDescription>
                </SheetHeader>

                {/* Dot grid */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                        zIndex: 0,
                    }}
                />

                {/* Body */}
                <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 custom-scrollbar">

                    {/* Page size */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                            PAGE LENGTH
                        </label>
                        <div className="relative">
                            <select
                                value={filters.pageSize || "25"}
                                onChange={(e) => setFilters((prev) => ({ ...prev, pageSize: e.target.value }))}
                                className="w-full px-2.5 py-1.5 text-[11px] border"
                                style={selectStyle}
                            >
                                {pageSizeOptions.map((s) => (
                                    <option key={s} value={s} style={{ backgroundColor: "#0d1117" }}>
                                        {s} items
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

                    {/* Filter fields */}
                    {filterFields.map(({ label, name, options }) => (
                        <div key={name} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                    {label}
                                </label>
                                {filters[name] && (
                                    <button
                                        onClick={() => setFilters((prev) => ({ ...prev, [name]: "" }))}
                                        className="text-[8px] uppercase tracking-widest transition-opacity hover:opacity-70"
                                        style={{ color: "rgba(255,255,255,0.25)" }}
                                    >
                                        CLEAR
                                    </button>
                                )}
                            </div>
                            <select
                                value={filters[name] || ""}
                                onChange={(e) => setFilters((prev) => ({ ...prev, [name]: e.target.value }))}
                                className="w-full px-2.5 py-1.5 text-[11px] border"
                                style={selectStyle}
                            >
                                <option value="" style={{ backgroundColor: "#0d1117", color: "rgba(255,255,255,0.3)" }}>
                                    — ALL —
                                </option>
                                {options.map((o) => (
                                    <option key={o} value={o} style={{ backgroundColor: "#0d1117", color: "#e2e8f0" }}>
                                        {o}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div
                    className="relative z-10 flex items-center justify-between px-4 py-3 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                    <button
                        onClick={resetFilters}
                        className={termBtn}
                        style={{ color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.1)" }}
                    >
                        RESET
                    </button>
                    <button
                        onClick={applyFilters}
                        className={termBtn}
                        style={{ backgroundColor: "#fb923c", color: "#000", borderColor: "transparent" }}
                    >
                        APPLY
                    </button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
