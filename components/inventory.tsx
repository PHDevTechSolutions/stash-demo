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

interface TicketProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

const statusColors: Record<string, string> = {
    Spare: "bg-green-100 text-green-800",
    Deploy: "bg-blue-100 text-blue-800",
    Lend: "bg-purple-100 text-purple-800",
    Missing: "bg-yellow-100 text-yellow-800",
    Defective: "bg-red-100 text-red-800",
    Dispose: "bg-gray-200 text-gray-800",
};

const PAGE_SIZE = 10;

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

    const [filters, setFilters] = useState({
        status: "",
        location: "",
        asset_type: "",
        department: "",
        brand: "",
        model: "",
        processor: "",
        storage: "",
    });

    const [hasOldItems, setHasOldItems] = useState(false);
    const [oldItems, setOldItems] = useState<InventoryItem[]>([]);
    const [updatingOldItems, setUpdatingOldItems] = useState(false);

    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkReferenceId, setBulkReferenceId] = useState(referenceid);

    useEffect(() => {
    setBulkReferenceId(referenceid);
  }, [referenceid]);

    const [uploadingBulk, setUploadingBulk] = useState(false);

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
                    return purchaseDate < fiveYearsAgo && item.status !== "Dispose";
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
        });
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

        return activities.filter((item) => {
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
    }, [activities, search, filters, dateCreatedFilterRange]);


    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);

    const paginatedActivities = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredActivities.slice(start, start + PAGE_SIZE);
    }, [filteredActivities, page]);

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
            asset_tag: item.asset_tag ?? "",
            asset_type: item.asset_type ?? "",
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

    async function updateOldItemsStatusManual() {
        if (oldItems.length === 0) {
            toast("No old items to update.");
            return;
        }

        setUpdatingOldItems(true);

        try {
            const idsToUpdate = oldItems.map(i => i.id);

            const res = await fetch("/api/update-status-old-items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: idsToUpdate, newStatus: "Dispose" }),
            });

            if (!res.ok) {
                const json = await res.json();
                toast.error("Failed to update old items: " + (json.error ?? ""));
                setUpdatingOldItems(false);
                return;
            }

            toast.success(`${idsToUpdate.length} old item(s) updated to Dispose.`);

            // Refresh activities after update
            fetchActivities();
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
                <div className="flex items-center justify-between space-x-4">
                    <Input
                        placeholder="Search inventory..."
                        className="text-xs flex-grow max-w-[400px]"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                            setSelectedIds(new Set());
                        }}
                    />

                    <div className="flex space-x-2 items-center">
                        {selectedIds.size > 0 && (
                            <Button variant="destructive" onClick={handleDeleteSelected}>
                                Delete Selected ({selectedIds.size})
                            </Button>
                        )}
                        <Button
                            onClick={() => {
                                resetForm();
                                setOpen(true);
                            }}
                        >
                            Add New
                        </Button>

                        <Button variant="outline" onClick={() => setBulkOpen(true)}>
                            Bulk Upload
                        </Button>


                        {hasOldItems && (

                            <Button
                                variant="destructive"
                                onClick={updateOldItemsStatusManual}
                                disabled={updatingOldItems}
                            >
                                {updatingOldItems ? "Updating Old Items..." : "Update Old Items to Dispose"}
                            </Button>

                        )}

                        <InventoryFilterDialog
                            open={filterSheetOpen}
                            setOpen={setFilterSheetOpen}
                            filters={filters}
                            handleFilterChange={handleFilterChange}
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
                                        <Badge className={statusColors[item.status] ?? "bg-gray-100 text-gray-700"}>
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

                        <div className="text-xs text-muted-foreground">
                            Required headers:
                            <br />
                            <code>
                                asset_tag, asset_type, status, location, new_user, old_user,
                                department, position, brand, model, processor, ram, storage,
                                serial_number, purchase_date, warranty_date, asset_age,
                                amount, remarks, mac_address
                            </code>
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
