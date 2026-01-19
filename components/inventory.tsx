"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell, } from "@/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious, } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { InventoryDialog } from "@/components/inventory-dialog";
import { InventoryFilterDialog } from "@/components/inventory-filter-dialog";
import { supabase } from "@/utils/supabase";

interface InventoryItem {
    id: string; // supabase id
    referenceid: string;
    asset_tag?: string;
    asset_type?: string;
    status: string;
    location?: string;
    new_user?: string;
    old_user?: string;
    department?: string;
    position?: string;
    brand?: string;
    model?: string;
    processor?: string;
    ram?: string;
    storage?: string;
    serial_number?: string;
    purchase_date?: string;
    warranty_date?: string;
    asset_age?: string;
    amount?: string;
    remarks?: string;
    mac_address?: string;
    date_created?: string;
}

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

interface TicketProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

const statusColors: Record<string, string> = {
    SPARE: "bg-green-100 text-green-800",
    DEPLOYED: "bg-blue-100 text-blue-800",
    LEND: "bg-purple-100 text-purple-800",
    MISSING: "bg-yellow-100 text-yellow-800",
    DEFECTIVE: "bg-red-100 text-red-800",
    DISPOSE: "bg-gray-200 text-gray-800",
};

export const Inventory: React.FC<TicketProps> = ({
    referenceid,
    dateCreatedFilterRange,
}) => {
    const [activities, setActivities] = useState<InventoryItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<
        Omit<InventoryItem, "id" | "date_created" | "referenceid">
    >({
        asset_tag: "",
        asset_type: "",
        status: "",
        location: "",
        new_user: "",
        old_user: "",
        department: "",
        position: "",
        brand: "",
        model: "",
        processor: "",
        ram: "",
        storage: "",
        serial_number: "",
        purchase_date: "",
        warranty_date: "",
        asset_age: "",
        amount: "",
        remarks: "",
        mac_address: "",
    });

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    const [filters, setFilters] = useState<InventoryFilters>({
        status: "",
        location: "",
        asset_type: "",
        department: "",
        brand: "",
        model: "",
        processor: "",
        storage: "",
        pageSize: "25",
    });

    const [hasOldItems, setHasOldItems] = useState(false);
    const [oldItems, setOldItems] = useState<InventoryItem[]>([]);
    const [updatingOldItems, setUpdatingOldItems] = useState(false);

    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkReferenceId, setBulkReferenceId] = useState(referenceid);

    const pageSize = useMemo(() => {
        const size = Number(filters.pageSize);
        return Number.isFinite(size) && size > 0 ? size : 25;
    }, [filters.pageSize]);


    useEffect(() => {
        setBulkReferenceId(referenceid);
    }, [referenceid]);

    const [uploadingBulk, setUploadingBulk] = useState(false);
    const [disposeSheetOpen, setDisposeSheetOpen] = useState(false);
    const [selectedDisposeIds, setSelectedDisposeIds] = useState<Set<string>>(new Set());

    function handleSelectChange(name: string, value: string) {
        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    function handleSetAssetTag(value: string) {
        setForm((prev) => ({ ...prev, asset_tag: value }));
    }

    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
            setHasOldItems(false);
            setOldItems([]);
            return;
        }
        setLoadingActivities(true);
        setErrorActivities(null);

        fetch(`/api/fetch-inventory?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch activities");
                return res.json();
            })
            .then((data) => {
                const items: InventoryItem[] = data.data || [];
                setActivities(items);

                // NEW: Detect old items 5 years+ and not disposed
                const fiveYearsAgo = new Date();
                fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

                const oldOnes = items.filter(item => {
                    if (!item.purchase_date) return false;
                    const purchaseDate = new Date(item.purchase_date);
                    if (isNaN(purchaseDate.getTime())) return false;
                    return purchaseDate < fiveYearsAgo && item.status !== "DISPOSE";
                });

                setOldItems(oldOnes);
                setHasOldItems(oldOnes.length > 0);
            })
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid]);

    useEffect(() => {
        fetchActivities();

        if (!referenceid) return;

        const channel = supabase
            .channel(`public:inventory:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "inventory",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as InventoryItem;
                    const oldRecord = payload.old as InventoryItem;

                    setActivities((curr) => {
                        switch (payload.eventType) {
                            case "INSERT":
                                if (!curr.some((a) => a.id === newRecord.id)) {
                                    return [...curr, newRecord];
                                }
                                return curr;
                            case "UPDATE":
                                return curr.map((a) => (a.id === newRecord.id ? newRecord : a));
                            case "DELETE":
                                return curr.filter((a) => a.id !== oldRecord.id);
                            default:
                                return curr;
                        }
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [referenceid, fetchActivities]);

    function handleFilterChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    }

    function resetFilters() {
        setFilters({
            status: "",
            location: "",
            asset_type: "",
            department: "",
            brand: "",
            model: "",
            processor: "",
            storage: "",
            pageSize: "25", // 👈 default
        });
        setPage(1);
    }

    function applyFilters() {
        setPage(1);
        setFilterSheetOpen(false);
    }

    const filteredActivities = useMemo(() => {
        if (!activities.length) return [];

        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (dateCreatedFilterRange?.from) {
            startDate = new Date(dateCreatedFilterRange.from);
            startDate.setHours(0, 0, 0, 0);
        }

        if (dateCreatedFilterRange?.to) {
            endDate = new Date(dateCreatedFilterRange.to);
            endDate.setHours(23, 59, 59, 999);
        }

        // Filter first
        const filtered = activities.filter((item) => {
            // EXCLUDE items with status "Dispose"
            if (item.status === "Dispose") return false;

            const matchesSearch =
                search.trim() === "" ||
                Object.values(item).some((val) =>
                    val?.toString().toLowerCase().includes(search.toLowerCase())
                );

            if (!matchesSearch) return false;

            const matchesFilters = Object.entries(filters).every(([key, filterValue]) => {
                if (!filterValue) return true;
                if (key === "pageSize") return true; // 👈 IMPORTANT

                const itemValue = item[key as keyof InventoryItem];
                return (
                    itemValue
                        ?.toString()
                        .toLowerCase()
                        .includes(filterValue.toLowerCase()) ?? false
                );
            });

            if (!matchesFilters) return false;

            if (startDate || endDate) {
                if (!item.purchase_date) return false;

                const itemDate = new Date(item.purchase_date);
                if (isNaN(itemDate.getTime())) return false;

                if (startDate && itemDate < startDate) return false;
                if (endDate && itemDate > endDate) return false;
            }

            return true;
        });

        // Sort descending by asset_tag
        filtered.sort((a, b) => {
            if (!a.asset_tag) return 1;   // Push undefined asset_tag to the end
            if (!b.asset_tag) return -1;
            return b.asset_tag.localeCompare(a.asset_tag);
        });

        return filtered;
    }, [activities, search, filters, dateCreatedFilterRange]);

    const totalSpareCount = useMemo(() => {
        return filteredActivities.length;
    }, [filteredActivities]);

    const pageCount = Math.ceil(filteredActivities.length / pageSize);

    const paginatedActivities = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredActivities.slice(start, start + pageSize);
    }, [filteredActivities, page, pageSize]);

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }

    async function handleSubmit() {
        if (!form.status) {
            alert("Status is required");
            return;
        }

        try {
            const res = await fetch("/api/create-inventory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, referenceid }),
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to create inventory");
            }

            toast.success("Inventory created successfully!");
            fetchActivities();
            setOpen(false);
            resetForm();
        } catch (error: any) {
            toast.error(error.message || "Error creating inventory");
        }
    }

    async function handleUpdate() {
        if (!form.status) {
            alert("Status is required");
            return;
        }
        if (!editingId) {
            alert("No item selected for update");
            return;
        }

        try {
            const res = await fetch(`/api/update-inventory?id=${encodeURIComponent(editingId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, referenceid }),
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to update inventory");
            }

            toast.success("Inventory updated successfully!");
            fetchActivities();
            setOpen(false);
            resetForm();
        } catch (error: any) {
            toast.error(error.message || "Error updating inventory");
        }
    }

    function resetForm() {
        setForm({
            asset_tag: "",
            asset_type: "",
            status: "",
            location: "",
            new_user: "",
            old_user: "",
            department: "",
            position: "",
            brand: "",
            model: "",
            processor: "",
            ram: "",
            storage: "",
            serial_number: "",
            purchase_date: "",
            warranty_date: "",
            asset_age: "",
            amount: "",
            remarks: "",
            mac_address: "",
        });
        setEditingId(null);
    }

    function openEditDialog(item: InventoryItem) {
        setEditingId(item.id);
        setForm({
            status: item.status,
            location: item.location ?? "",
            new_user: item.new_user ?? "",
            old_user: item.old_user ?? "",
            department: item.department ?? "",
            position: item.position ?? "",
            brand: item.brand ?? "",
            model: item.model ?? "",
            processor: item.processor ?? "",
            ram: item.ram ?? "",
            storage: item.storage ?? "",
            serial_number: item.serial_number ?? "",
            purchase_date: item.purchase_date ?? "",
            warranty_date: item.warranty_date ?? "",
            asset_age: item.asset_age ?? "",
            amount: item.amount ?? "",
            remarks: item.remarks ?? "",
            mac_address: item.mac_address ?? "",
        });
        setOpen(true);
    }

    function toggleSelect(id: string) {
        setSelectedIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }

    function toggleSelectAll() {
        const allSelected = paginatedActivities.every((item) => selectedIds.has(item.id));
        if (allSelected) {
            setSelectedIds((prev) => {
                const newSet = new Set(prev);
                paginatedActivities.forEach((item) => newSet.delete(item.id));
                return newSet;
            });
        } else {
            setSelectedIds((prev) => {
                const newSet = new Set(prev);
                paginatedActivities.forEach((item) => newSet.add(item.id));
                return newSet;
            });
        }
    }

    async function handleDeleteSelected() {
        if (selectedIds.size === 0) return;
        setConfirmDeleteOpen(true);
    }

    async function confirmDeletion() {
        try {
            const res = await fetch("/api/delete-inventory", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to delete inventory items");
            }

            toast.success(`${selectedIds.size} item(s) deleted successfully.`);
            setSelectedIds(new Set());
            setConfirmDeleteOpen(false);
            fetchActivities();
        } catch (error: any) {
            toast.error(error.message || "Error deleting inventory items");
            setConfirmDeleteOpen(false);
        }
    }

    function toggleDisposeSelect(id: string) {
        setSelectedDisposeIds((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }

    function toggleDisposeSelectAll() {
        if (selectedDisposeIds.size === oldItems.length) {
            setSelectedDisposeIds(new Set());
        } else {
            setSelectedDisposeIds(new Set(oldItems.map((i) => i.id)));
        }
    }

    async function confirmUpdateDispose() {
        if (selectedDisposeIds.size === 0) {
            toast.error("Please select at least one item to update.");
            return;
        }

        setUpdatingOldItems(true);

        try {
            const res = await fetch("/api/update-status-old-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(selectedDisposeIds), newStatus: "Dispose" }),
            });

            if (!res.ok) {
                const json = await res.json();
                toast.error("Failed to update old items: " + (json.error ?? ""));
                setUpdatingOldItems(false);
                return;
            }

            toast.success(`${selectedDisposeIds.size} item(s) updated to Dispose.`);
            fetchActivities();
            setDisposeSheetOpen(false);
            setSelectedDisposeIds(new Set());
        } catch (error) {
            toast.error("Error updating old items.");
            console.error(error);
        } finally {
            setUpdatingOldItems(false);
        }
    }

    const handleBulkUpload = async () => {
        if (!bulkFile) {
            toast.error("Please select a CSV file");
            return;
        }

        setUploadingBulk(true);

        try {
            const text = await bulkFile.text();
            const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

            if (lines.length < 2) {
                throw new Error("CSV file is empty");
            }

            const headers = lines[0].split(",").map(h => h.trim());

            const allowedFields = [
                "asset_tag",
                "asset_type",
                "status",
                "location",
                "new_user",
                "old_user",
                "department",
                "position",
                "brand",
                "model",
                "processor",
                "ram",
                "storage",
                "serial_number",
                "purchase_date",
                "warranty_date",
                "asset_age",
                "amount",
                "remarks",
                "mac_address",
            ];

            // validate headers
            const invalidHeaders = headers.filter(h => !allowedFields.includes(h));
            if (invalidHeaders.length > 0) {
                throw new Error(`Invalid column(s): ${invalidHeaders.join(", ")}`);
            }

            const records = lines.slice(1).map((line, index) => {
                const values = line.split(",").map(v => v.replace(/^"|"$/g, "").trim());

                const row: any = {
                    referenceid: bulkReferenceId,
                    status: "Spare", // default
                };

                headers.forEach((h, i) => {
                    row[h] = values[i] || null;
                });

                return row;
            });

            const { error } = await supabase
                .from("inventory")
                .insert(records);

            if (error) throw error;

            toast.success(`${records.length} item(s) uploaded successfully`);
            setBulkOpen(false);
            setBulkFile(null);
            fetchActivities();
        } catch (err: any) {
            toast.error(err.message || "Bulk upload failed");
        } finally {
            setUploadingBulk(false);
        }
    };

    useEffect(() => {
        setPage(1);
    }, [search, filters]);


    function convertToCSV(items: InventoryItem[]) {
        if (items.length === 0) return "";

        const headers = [
            "id",
            "referenceid",
            "asset_tag",
            "asset_type",
            "status",
            "location",
            "new_user",
            "old_user",
            "department",
            "position",
            "brand",
            "model",
            "processor",
            "ram",
            "storage",
            "serial_number",
            "purchase_date",
            "warranty_date",
            "asset_age",
            "amount",
            "remarks",
            "mac_address",
            "date_created",
        ];

        const escapeCSV = (value: any) => {
            if (value == null) return "";
            const str = value.toString();
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`; // escape double quotes
            }
            return str;
        };

        const csvRows = [
            headers.join(","), // header row
            ...items.map((item) =>
                headers.map((header) => escapeCSV(item[header as keyof InventoryItem])).join(",")
            ),
        ];

        return csvRows.join("\n");
    }

    function handleDownloadCSV() {
        // Use activities or filteredActivities as needed
        const csv = convertToCSV(activities); // or filteredActivities for filtered data
        if (!csv) {
            toast.error("No data available to download");
            return;
        }

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    if (errorActivities) {
        return (
            <Alert variant="destructive" className="flex flex-col space-y-4 p-4 text-xs">
                <div className="flex items-center space-x-3">
                    <AlertCircleIcon className="h-6 w-6 text-red-600" />
                    <div>
                        <AlertTitle>No Data Found or No Network Connection</AlertTitle>
                        <AlertDescription className="text-xs">
                            Please check your internet connection or try again later.
                        </AlertDescription>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <CheckCircle2Icon className="h-6 w-6 text-green-600" />
                    <div>
                        <AlertTitle className="text-black">Create New Data</AlertTitle>
                        <AlertDescription className="text-xs">
                            You can start by adding new entries to populate your database.
                        </AlertDescription>
                    </div>
                </div>
            </Alert>
        );
    }

    return (
        <Card className="w-full p-4 rounded-xl flex flex-col">
            <CardHeader className="p-0 mb-2">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                    {/* Search */}
                    <div className="flex items-center justify-between mb-4 gap-2">
                        <Input
                            type="search"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="max-w-sm"
                        />

                        <Button onClick={handleDownloadCSV} variant="outline">
                            Download CSV
                        </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <p className="font-semibold">Total Assets ( Except Dispose Item ):</p>
                        <Badge className="bg-green-600 text-white py-2 px-4 text-sm">
                            {totalSpareCount}
                        </Badge>

                        {selectedIds.size > 0 && (
                            <Button
                                variant="destructive"
                                className="w-full sm:w-auto"
                                onClick={handleDeleteSelected}
                            >
                                Delete Selected ({selectedIds.size})
                            </Button>
                        )}

                        <Button
                            className="w-full sm:w-auto"
                            onClick={() => {
                                resetForm();
                                setOpen(true);
                            }}
                        >
                            Add New
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => setBulkOpen(true)}
                        >
                            Bulk Upload
                        </Button>

                        {hasOldItems && (
                            <Button
                                variant="destructive"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                    setSelectedDisposeIds(new Set()); // reset selection when opening
                                    setDisposeSheetOpen(true);
                                }}
                                disabled={updatingOldItems}
                            >
                                {updatingOldItems ? "Updating Old Items..." : "Update Old Items to Dispose"}
                            </Button>
                        )}

                        <InventoryFilterDialog
                            open={filterSheetOpen}
                            setOpen={setFilterSheetOpen}
                            filters={filters}
                            setFilters={setFilters}
                            resetFilters={resetFilters}
                            applyFilters={applyFilters}
                        />

                    </div>
                </div>
            </CardHeader>

            {loadingActivities ? (
                <div className="flex justify-center py-10">
                    <Spinner />
                </div>
            ) : filteredActivities.length === 0 ? (
                <div className="text-muted-foreground text-sm p-3 border rounded-lg text-center">
                    No inventory data available.
                </div>
            ) : (
                <>
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead>
                                    <input
                                        type="checkbox"
                                        onChange={toggleSelectAll}
                                        checked={
                                            paginatedActivities.length > 0 &&
                                            paginatedActivities.every((item) => selectedIds.has(item.id))
                                        }
                                        aria-label="Select all items on page"
                                    />
                                </TableHead>
                                <TableHead>Actions</TableHead>
                                <TableHead>Asset Tag</TableHead>
                                <TableHead>Asset Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>New User</TableHead>
                                <TableHead>Old User</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead>Model</TableHead>
                                <TableHead>Processor</TableHead>
                                <TableHead>RAM</TableHead>
                                <TableHead>Storage</TableHead>
                                <TableHead>Serial Number</TableHead>
                                <TableHead>Purchase Date</TableHead>
                                <TableHead>Asset Age</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Remarks</TableHead>
                                <TableHead>MAC Address</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedActivities.map((item) => (
                                <TableRow key={item.id} className="odd:bg-white even:bg-gray-50">
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => toggleSelect(item.id)}
                                            aria-label={`Select item ${item.asset_tag || item.id}`}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}>
                                            Edit
                                        </Button>
                                    </TableCell>
                                    <TableCell>{item.asset_tag || "-"}</TableCell>
                                    <TableCell>{item.asset_type || "-"}</TableCell>
                                    <TableCell>
                                        <Badge className={statusColors[item.status] ?? "bg-gray-100 text-gray-700 uppercase"}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{item.location || "-"}</TableCell>
                                    <TableCell>{item.new_user || "-"}</TableCell>
                                    <TableCell>{item.old_user || "-"}</TableCell>
                                    <TableCell>{item.department || "-"}</TableCell>
                                    <TableCell>{item.position || "-"}</TableCell>
                                    <TableCell>{item.brand || "-"}</TableCell>
                                    <TableCell>{item.model || "-"}</TableCell>
                                    <TableCell>{item.processor || "-"}</TableCell>
                                    <TableCell>{item.ram || "-"}</TableCell>
                                    <TableCell>{item.storage || "-"}</TableCell>
                                    <TableCell>{item.serial_number || "-"}</TableCell>
                                    <TableCell>
                                        {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : "-"}
                                    </TableCell>
                                    <TableCell>{item.asset_age || "-"}</TableCell>
                                    <TableCell>{item.amount || "-"}</TableCell>
                                    <TableCell>{item.remarks || "-"}</TableCell>
                                    <TableCell>{item.mac_address || "-"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    <div className="flex justify-end mt-4">
                        <Pagination>
                            <PaginationContent className="flex items-center space-x-4">
                                <PaginationItem>
                                    <PaginationPrevious
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (page > 1) setPage(page - 1);
                                        }}
                                        aria-disabled={page <= 1}
                                        className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                                    />
                                </PaginationItem>

                                <div className="px-4 font-medium">{pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}</div>

                                <PaginationItem>
                                    <PaginationNext
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (page < pageCount) setPage(page + 1);
                                        }}
                                        aria-disabled={page >= pageCount}
                                        className={page >= pageCount ? "pointer-events-none opacity-50" : ""}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                </>
            )}

            <Sheet open={disposeSheetOpen} onOpenChange={setDisposeSheetOpen}>
                <SheetContent className="max-w-3xl">
                    <SheetHeader>
                        <SheetTitle>Update Old Items to Dispose</SheetTitle>
                        <SheetDescription>
                            Select the items you want to mark as Dispose.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="overflow-auto max-h-[60vh] mt-4 p-4">
                        <Accordion type="multiple" className="w-full">
                            {/* Select All Checkbox */}
                            <div className="flex items-center mb-4">
                                <input
                                    type="checkbox"
                                    id="selectAllDispose"
                                    className="mr-2"
                                    checked={selectedDisposeIds.size === oldItems.length && oldItems.length > 0}
                                    onChange={toggleDisposeSelectAll}
                                />
                                <label htmlFor="selectAllDispose" className="font-semibold">Select All</label>
                            </div>

                            {oldItems.map((item) => (
                                <AccordionItem key={item.id} value={item.id}>
                                    <AccordionTrigger className="flex justify-between items-center">
                                        <div className="space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedDisposeIds.has(item.id)}
                                                onChange={(e) => {
                                                    e.stopPropagation(); // prevent accordion toggle on checkbox click
                                                    toggleDisposeSelect(item.id);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="ml-4"
                                            />
                                            <span>{item.asset_tag || "No Asset Tag"}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4">
                                        <div className="grid grid-cols-1 gap-4 text-sm">
                                            <div><strong>Model:</strong> {item.model || "-"}</div>
                                            <div><strong>Brand:</strong> {item.brand || "-"}</div>
                                            <div><strong>Department:</strong> {item.department || "-"}</div>
                                            <div><strong>Location:</strong> {item.location || "-"}</div>
                                            <div><strong>Asset Type:</strong> {item.asset_type || "-"}</div>
                                            <div><strong>Status:</strong> {item.status || "-"}</div>
                                            <div><strong>Serial Number:</strong> {item.serial_number || "-"}</div>
                                            <div><strong>Purchase Date:</strong> {item.purchase_date || "-"}</div>
                                            <div><strong>Remarks:</strong> {item.remarks || "-"}</div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="outline" onClick={() => setDisposeSheetOpen(false)} disabled={updatingOldItems}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmUpdateDispose}
                            disabled={updatingOldItems || selectedDisposeIds.size === 0}
                        >
                            {updatingOldItems ? "Updating..." : "Update Selected"}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            <InventoryDialog
                open={open}
                setOpen={setOpen}
                editingId={editingId}
                form={form}
                handleInputChange={handleInputChange}
                handleSelectChange={handleSelectChange}
                handleSetAssetTag={handleSetAssetTag}
                handleSubmit={handleSubmit}
                handleUpdate={handleUpdate}
                resetForm={resetForm}
            />

            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Bulk Upload Inventory</DialogTitle>
                        <DialogDescription>
                            Upload CSV file. Columns must match inventory fields.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium">Reference ID</label>
                            <Input
                                value={bulkReferenceId}
                                onChange={(e) => setBulkReferenceId(e.target.value)}
                                disabled
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium">Upload CSV File</label>
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}

                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleBulkUpload} disabled={uploadingBulk}>
                            {uploadingBulk ? "Uploading..." : "Upload"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the selected inventory item(s)? This action cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDeletion}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};
