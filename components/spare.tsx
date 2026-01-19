"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";

import { InventoryFilterDialog } from "@/components/inventory-filter-dialog";
import { supabase } from "@/utils/supabase";

interface Item {
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
    SPARE: "bg-green-100 text-green-800",
    DEPLOYED: "bg-blue-100 text-blue-800",
    LEND: "bg-purple-100 text-purple-800",
    MISSING: "bg-yellow-100 text-yellow-800",
    DEFECTIVE: "bg-red-100 text-red-800",
    DISPOSE: "bg-gray-200 text-gray-800",
};

const PAGE_SIZE = 10;

export const Spare: React.FC<TicketProps> = ({
    referenceid,
    dateCreatedFilterRange,
}) => {
    const [activities, setActivities] = useState<Item[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

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
        pageSize: "25",
    });

    const pageSize = useMemo(() => {
        const size = Number(filters.pageSize);
        return Number.isFinite(size) && size > 0 ? size : 25;
    }, [filters.pageSize]);

    const fetchActivities = useCallback(() => {
        if (!referenceid) {
            setActivities([]);
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
                const items: Item[] = data.data || [];
                setActivities(items);
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
                    const newRecord = payload.new as Item;
                    const oldRecord = payload.old as Item;

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
            pageSize: "25",
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

        // Filter first
        const filtered = activities.filter((item) => {
            // EXCLUDE items with status "Dispose"
            if (item.status !== "SPARE") return false;

            const matchesSearch =
                search.trim() === "" ||
                Object.values(item).some((val) =>
                    val?.toString().toLowerCase().includes(search.toLowerCase())
                );

            if (!matchesSearch) return false;

            const matchesFilters = Object.entries(filters).every(([key, filterValue]) => {
                if (!filterValue) return true;
                if (key === "pageSize") return true; // 👈 IMPORTANT

                const itemValue = item[key as keyof Item];
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
            <CardHeader className="p-0 mb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* LEFT */}
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

                    {/* RIGHT */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* TOTAL SPARE BADGE */}
                        <Badge className="bg-green-600 text-white py-2 px-4 text-sm">
                            Total: {totalSpareCount}
                        </Badge>

                        {selectedIds.size > 0 && (
                            <Button variant="destructive" onClick={handleDeleteSelected}>
                                Delete Selected ({selectedIds.size})
                            </Button>
                        )}

                        <InventoryFilterDialog
                            open={filterSheetOpen}
                            setOpen={setFilterSheetOpen}
                            filters={filters}
                            setFilters={setFilters}
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
