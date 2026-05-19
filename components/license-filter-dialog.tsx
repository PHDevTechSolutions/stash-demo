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

interface LicenseFilterDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    filters: Record<string, string>;
    handleFilterChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    resetFilters: () => void;
    applyFilters: () => void;
}

const filterFields = [
    { label: "Compliance Status", name: "compliance_status", placeholder: "E.G. COMPLIANT" },
    { label: "Action",            name: "action",            placeholder: "E.G. RENEW"     },
];

const termBtn =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 cursor-pointer";

export function LicenseFilterDialog({
    open,
    setOpen,
    filters,
    handleFilterChange,
    resetFilters,
    applyFilters,
}: LicenseFilterDialogProps) {
    const activeCount = filterFields.filter(({ name }) => !!filters[name]).length;

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
                className="w-[280px] p-0 border-r font-mono flex flex-col"
                style={{ backgroundColor: "#0d1117", borderColor: "rgba(255,255,255,0.07)" }}
            >
                {/* Dot grid */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
                        backgroundSize: "20px 20px",
                        zIndex: 0,
                    }}
                />

                {/* Header */}
                <SheetHeader
                    className="relative z-10 px-4 py-3 border-b flex-row items-center justify-between"
                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(0,0,0,0.3)" }}
                >
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: "#fb923c", boxShadow: "0 0 5px #fb923c" }}
                        />
                        <SheetTitle
                            className="text-[10px] uppercase tracking-[0.2em] font-bold font-mono"
                            style={{ color: "#fb923c" }}
                        >
                            FILTER LICENSES
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
                        Filter license items by various criteria.
                    </SheetDescription>
                </SheetHeader>

                {/* Body */}
                <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 custom-scrollbar">
                    {filterFields.map(({ label, name, placeholder }) => (
                        <div key={name} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor={name}
                                    className="text-[9px] uppercase tracking-[0.15em]"
                                    style={{ color: "rgba(255,255,255,0.3)" }}
                                >
                                    {label}
                                </label>
                                {filters[name] && (
                                    <button
                                        onClick={() =>
                                            handleFilterChange({
                                                target: { name, value: "" },
                                            } as React.ChangeEvent<HTMLInputElement>)
                                        }
                                        className="text-[8px] uppercase tracking-widest transition-opacity hover:opacity-70"
                                        style={{ color: "rgba(255,255,255,0.25)" }}
                                    >
                                        CLEAR
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <span
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none"
                                    style={{ color: "rgba(255,255,255,0.2)" }}
                                >
                                    ›
                                </span>
                                <input
                                    id={name}
                                    name={name}
                                    value={filters[name] || ""}
                                    onChange={handleFilterChange}
                                    placeholder={placeholder}
                                    type="text"
                                    className="w-full pl-6 pr-3 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors"
                                    style={{
                                        backgroundColor: "rgba(255,255,255,0.03)",
                                        borderColor: "rgba(255,255,255,0.1)",
                                        color: "rgba(255,255,255,0.7)",
                                    }}
                                />
                            </div>
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
