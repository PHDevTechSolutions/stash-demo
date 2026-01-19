"use client";

import React from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

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

const filterFields: { label: string; name: FilterKeys }[] = [
  { label: "Status", name: "status" },
  { label: "Location", name: "location" },
  { label: "Asset Type", name: "asset_type" },
  { label: "Department", name: "department" },
];

export function InventoryFilterDialog({
  open,
  setOpen,
  filters,
  resetFilters,
  applyFilters,
  setFilters,
}: InventoryFilterDialogProps) {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">Filter</Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[320px] p-6 max-h-screen overflow-y-auto custom-scrollbar"
      >
        <SheetHeader>
          <SheetTitle>Filter Inventory</SheetTitle>
          <SheetDescription>
            Filter inventory items and control page length.
          </SheetDescription>
          <SheetClose />
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* PAGE LENGTH */}
          <div className="flex flex-col">
            <label className="text-xs font-medium mb-1">Page Length</label>
            <Select
              value={filters.pageSize || "25"}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  pageSize: value,
                }))
              }
            >
              <SelectTrigger className="text-sm w-full">
                <SelectValue placeholder="Select page length" />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 250, 500, 1000].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} items
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SELECT FILTERS */}
          {filterFields.map(({ label, name }) => {
            // Options with a sentinel "none" instead of empty string
            const options: string[] = (() => {
              switch (name) {
                case "status":
                  return [
                    "none",
                    "Spare",
                    "Deployed",
                    "Lend",
                    "Missing",
                    "Defective",
                    "Dispose",
                  ];
                case "location":
                  return ["none", "J&L", "Primex", "Pasig WH", "CDO", "Cebu", "Davao", "Buildchem", "Disruptive"];
                case "asset_type":
                  return ["none", "Laptop", "Desktop", "Monitor"];
                case "department":
                  return ["none", "Information Technology", "Human Resources", "Marketing", "Sales", "Accounting", "Procurement", "Admin", "Warehouse Operations", "Engineering", "Customer Service", "Ecommerce", "Product Development"];
                case "brand":
                  return ["none", "Dell", "HP", "Apple", "Lenovo"];
                case "model":
                  return ["none", "Model A", "Model B", "Model C"];
                case "processor":
                  return [
                    "none",
                    "Intel i5",
                    "Intel i7",
                    "AMD Ryzen 5",
                    "AMD Ryzen 7",
                  ];
                case "storage":
                  return ["none", "128GB", "256GB", "512GB", "1TB"];
                default:
                  return ["none"];
              }
            })();

            // Map filter value: internal "" <-> select "none"
            const currentValue = filters[name] === "" ? "none" : filters[name];

            return (
              <div key={name} className="flex flex-col">
                <label htmlFor={name} className="text-xs font-medium mb-1">
                  {label}
                </label>
                <Select
                  value={currentValue}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      [name]: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger id={name} className="text-sm w-full">
                    <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === "none" ? "None" : option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        <SheetFooter className="flex justify-between mt-4">
          <Button variant="outline" onClick={resetFilters}>
            Reset
          </Button>
          <Button onClick={applyFilters}>Apply</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
