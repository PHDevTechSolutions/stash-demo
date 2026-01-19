"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { supabase } from "@/utils/supabase";

interface AssignItem {
    id: string; // ✅ SUPABASE ID
    asset_tag?: string;
    asset_type?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    remarks?: string;
    date_created?: string;
    status?: string;
    fullName?: string;
    position?: string;
    department?: string;
}

interface AssignedAsset {
    id: string;
    assigned_number: string;
    asset_tag?: string;
    asset_type?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    new_user?: string;
    position?: string;
    department?: string;
    date_created?: string;
    status?: string;
}

interface AssignProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

const PAGE_SIZE = 10;

export const Assign: React.FC<AssignProps> = ({
    referenceid,
    dateCreatedFilterRange,
}) => {
    const [activities, setActivities] = useState<AssignItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    // New state for assigned assets
    const [assignedAssets, setAssignedAssets] = useState<AssignedAsset[]>([]);
    const [loadingAssignedAssets, setLoadingAssignedAssets] = useState(false);
    const [errorAssignedAssets, setErrorAssignedAssets] = useState<string | null>(null);

    const [editId, setEditId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<AssignedAsset>>({});

    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [selectedItems, setSelectedItems] = useState<AssignItem[]>([]);
    const [newUser, setNewUser] = useState("");
    const [oldUser, setOldUser] = useState("");
    const [position, setPosition] = useState("");
    const [department, setDepartment] = useState("");
    const [remarks, setRemarks] = useState("");

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
                const items: AssignItem[] = data.data || [];
                setActivities(items);
            })
            .catch((err) => setErrorActivities(err.message))
            .finally(() => setLoadingActivities(false));
    }, [referenceid]);

    const fetchAssignedAssets = useCallback(() => {
        if (!referenceid) {
            setAssignedAssets([]);
            return;
        }
        setLoadingAssignedAssets(true);
        setErrorAssignedAssets(null);

        fetch(`/api/fetch-assigned-assets?referenceid=${encodeURIComponent(referenceid)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch assigned assets");
                return res.json();
            })
            .then((data) => {
                const items: AssignedAsset[] = data.data || [];
                setAssignedAssets(items);
            })
            .catch((err) => setErrorAssignedAssets(err.message))
            .finally(() => setLoadingAssignedAssets(false));
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
                    const newRecord = payload.new as AssignItem;
                    const oldRecord = payload.old as AssignItem;

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

    useEffect(() => {
        fetchAssignedAssets();

        if (!referenceid) return;

        const channel = supabase
            .channel(`public:assign_asset:referenceid=eq.${referenceid}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "assign_asset",
                    filter: `referenceid=eq.${referenceid}`,
                },
                (payload) => {
                    const newRecord = payload.new as AssignedAsset;
                    const oldRecord = payload.old as AssignedAsset;

                    setAssignedAssets((curr) => {
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
    }, [referenceid, fetchAssignedAssets]);

    // ✅ FILTERING
    const filteredActivities = useMemo(() => {
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
            // 🚫 HUWAG IPAKITA KAPAG DISPOSE
            if (
                item.status?.toLowerCase() === "dispose" ||
                item.status?.toLowerCase() === "missing" ||
                item.status?.toLowerCase() === "deployed" ||
                item.status?.toLowerCase() === "lend" ||
                item.status?.toLowerCase() === "defective"
            ) return false;

            const matchesSearch =
                search.trim() === "" ||
                Object.values(item).some((val) =>
                    val?.toString().toLowerCase().includes(search.toLowerCase())
                );

            if (!matchesSearch) return false;

            if (startDate || endDate) {
                if (!item.date_created) return false;
                const d = new Date(item.date_created);
                if (startDate && d < startDate) return false;
                if (endDate && d > endDate) return false;
            }

            return true;
        });
    }, [activities, search, dateCreatedFilterRange]);

    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);

    const paginatedActivities = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredActivities.slice(start, start + PAGE_SIZE);
    }, [filteredActivities, page]);

    // ✅ ADD / REMOVE
    const handleAddItem = (item: AssignItem) => {
        setSelectedItems((prev) =>
            prev.find((i) => i.id === item.id)
                ? prev
                : [
                    ...prev,
                    {
                        ...item,
                        selectedType: "",
                        quantity: 1,
                        fullName: "",
                        position: "",
                        department: "",
                    },
                ]
        );
    };

    const handleRemoveItem = (id: string) => {
        setSelectedItems((prev) => prev.filter((i) => i.id !== id));
    };

    const handleSubmit = async () => {
        if (selectedItems.length === 0) {
            toast.error("No selected items");
            return;
        }

        if (!newUser || !position || !department) {
            toast.error("Please complete user information");
            return;
        }

        try {
            const payload = {
                referenceid,
                new_user: newUser,
                old_user: oldUser || null,
                position,
                department,
                remarks,
                items: selectedItems.map((item) => ({
                    inventory_id: item.id,
                    asset_tag: item.asset_tag,
                    asset_type: item.asset_type,
                    brand: item.brand,
                    model: item.model,
                    serial_number: item.serial_number,
                })),
            };

            const res = await fetch("/api/create-assign-asset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || "Failed to assign assets");
            }

            toast.success("Assets successfully assigned");

            // RESET FORM
            setSelectedItems([]);
            setNewUser("");
            setOldUser("");
            setPosition("");
            setDepartment("");

        } catch (err: any) {
            toast.error(err.message || "Submission failed");
        }
    };

    const openDeleteDialog = (id: string) => {
        setDeleteTargetId(id);
        setConfirmDeleteOpen(true);
    };

    const confirmDeletion = async () => {
        if (!deleteTargetId) return;

        try {
            const res = await fetch(`/api/delete-assigned-asset?id=${encodeURIComponent(deleteTargetId)}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to delete assigned asset");
            }

            toast.success("Assigned asset deleted");
            fetchAssignedAssets();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setConfirmDeleteOpen(false);
            setDeleteTargetId(null);
        }
    };

    const startEdit = (item: AssignedAsset) => {
        setEditId(item.id);
        setEditData({
            new_user: item.new_user,
            position: item.position,
            department: item.department,
        });
    };

    const cancelEdit = () => {
        setEditId(null);
        setEditData({});
    };

    const handleEditChange = (field: keyof AssignedAsset, value: string) => {
        setEditData((prev) => ({ ...prev, [field]: value }));
    };

    const handleUpdate = async () => {
        if (!editId) return;

        try {
            const res = await fetch("/api/update-assigned-asset", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editId, ...editData }),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || "Failed to update assigned asset");
            }

            toast.success("Assigned asset updated");
            cancelEdit();
            fetchAssignedAssets();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <>
            <div className={selectedItems.length > 0 ? "grid grid-cols-1 md:grid-cols-2 gap-4 w-full" : "w-full"}>
                {/* LEFT */}
                <Card className={selectedItems.length > 0 ? "p-4" : "p-4 w-full"}>
                    <CardHeader className="p-0 mb-2">
                        <div className="flex items-center justify-between gap-2">
                            {/* Search */}
                            <Input
                                placeholder="Search assets..."
                                className="text-xs max-w-xs"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                            />

                            {/* Count */}
                            <div className="text-xs text-muted-foreground">
                                <Badge className="px-2 py-2">
                                    Total Items: {filteredActivities.length}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4">
                        {loadingActivities ? (
                            <div className="flex justify-center py-10">
                                <Spinner />
                            </div>
                        ) : errorActivities ? (
                            <Alert variant="destructive">
                                <AlertCircleIcon className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{errorActivities}</AlertDescription>
                            </Alert>
                        ) : (
                            <>
                                <Table className="text-xs">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead></TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Asset Tag</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Brand</TableHead>
                                            <TableHead>Model</TableHead>
                                            <TableHead>Serial</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedActivities.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <Button
                                                        className="text-xs"
                                                        onClick={() => handleAddItem(item)}
                                                    >
                                                        Choose
                                                    </Button>
                                                </TableCell>
                                                <TableCell><Badge className="text-xs capitalize">{item.status}</Badge></TableCell>
                                                <TableCell>{item.asset_tag}</TableCell>
                                                <TableCell>{item.asset_type}</TableCell>
                                                <TableCell>{item.brand}</TableCell>
                                                <TableCell>{item.model}</TableCell>
                                                <TableCell>{item.serial_number}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                <Pagination className="mt-4 justify-center">
                                    <PaginationContent>
                                        <PaginationItem>
                                            <PaginationPrevious
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (page > 1) setPage(page - 1);
                                                }}
                                            />
                                        </PaginationItem>
                                        <div className="px-2 text-xs">
                                            {page} / {pageCount || 1}
                                        </div>
                                        <PaginationItem>
                                            <PaginationNext
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (page < pageCount) setPage(page + 1);
                                                }}
                                            />
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            </>
                        )}
                    </CardContent>
                </Card>

                {selectedItems.length > 0 && (
                    <Card className="p-4 overflow-x-auto">
                        <CardHeader>
                            <CardTitle className="text-sm">Selected Items</CardTitle>
                        </CardHeader>

                        <CardContent>
                            {/* your right card content */}
                            <Table className="text-xs">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Asset Tag</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>

                                <TableBody>
                                    {selectedItems.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.asset_tag}</TableCell>
                                            {/* Action */}
                                            <TableCell className="text-right">
                                                <button
                                                    className="text-red-600 hover:text-red-800 text-xs"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                >
                                                    Remove
                                                </button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* ADDITIONAL INFO */}
                            <div className="mt-6 space-y-4 border-t pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* New User */}
                                    <div>
                                        <label className="block text-xs font-medium mb-1">New User</label>
                                        <Input
                                            placeholder="Enter new user"
                                            className="text-xs"
                                            value={newUser}
                                            onChange={(e) => setNewUser(e.target.value)}
                                        />
                                    </div>

                                    {/* Old User */}
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Old User</label>
                                        <Input
                                            placeholder="Enter old user"
                                            className="text-xs"
                                            value={oldUser}
                                            onChange={(e) => setOldUser(e.target.value)}
                                        />
                                    </div>

                                    {/* Position */}
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Position</label>
                                        <Input
                                            placeholder="Enter position"
                                            className="text-xs"
                                            value={position}
                                            onChange={(e) => setPosition(e.target.value)}
                                        />
                                    </div>

                                    {/* Department */}
                                    <div>
                                        <label className="block text-xs font-medium mb-1">Department</label>
                                        <Select
                                            value={department}
                                            onValueChange={(value) => setDepartment(value)}
                                        >
                                            <SelectTrigger className="text-xs w-full" aria-label="Select department">
                                                <SelectValue placeholder="Select department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[
                                                    "Information Technology",
                                                    "Human Resources",
                                                    "Marketing",
                                                    "Sales",
                                                    "Accounting",
                                                    "Procurement",
                                                    "Admin",
                                                    "Warehouse Operations",
                                                    "Engineering",
                                                    "Customer Service",
                                                    "Ecommerce",
                                                    "Product Development",
                                                ].map((dept) => (
                                                    <SelectItem key={dept} value={dept}>
                                                        {dept}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Remarks</label>
                                    <Textarea
                                        rows={2}
                                        placeholder="Enter old user"
                                        className="text-xs"
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <Button onClick={handleSubmit} disabled={selectedItems.length === 0}>
                                    Submit Assignment
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="mt-4 w-full">
                <Card className="p-4 overflow-x-auto">
                    <CardHeader>
                        <CardTitle className="text-sm">Assigned Assets</CardTitle>
                    </CardHeader>

                    <CardContent>
                        {loadingAssignedAssets ? (
                            <div className="flex justify-center py-10">
                                <Spinner />
                            </div>
                        ) : errorAssignedAssets ? (
                            <Alert variant="destructive">
                                <AlertCircleIcon className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{errorAssignedAssets}</AlertDescription>
                            </Alert>
                        ) : assignedAssets.length === 0 ? (
                            <div className="text-muted-foreground text-xs">No assigned assets found.</div>
                        ) : (
                            <Table className="text-xs">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Actions</TableHead>
                                        <TableHead>Assigned Number</TableHead>
                                        <TableHead>Asset Tag</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Brand</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead>Serial</TableHead>
                                        <TableHead>New User</TableHead>
                                        <TableHead>Position</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Date Created</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assignedAssets.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="space-x-1">
                                                {editId === item.id ? (
                                                    <>
                                                        <Button onClick={handleUpdate}>
                                                            Save
                                                        </Button>
                                                        <Button

                                                            variant="outline"
                                                            onClick={cancelEdit}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button

                                                            onClick={() => startEdit(item)}
                                                        >
                                                            Update
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            onClick={() => openDeleteDialog(item.id)}
                                                        >
                                                            Delete
                                                        </Button>

                                                    </>
                                                )}
                                            </TableCell>
                                            <TableCell>{item.assigned_number}</TableCell>
                                            <TableCell>{item.asset_tag}</TableCell>
                                            <TableCell>{item.asset_type}</TableCell>
                                            <TableCell>{item.brand}</TableCell>
                                            <TableCell>{item.model}</TableCell>
                                            <TableCell>{item.serial_number}</TableCell>
                                            {/* Editable fields for new_user, position, department */}
                                            <TableCell>
                                                {editId === item.id ? (
                                                    <input
                                                        type="text"
                                                        className="w-full text-xs border rounded px-1"
                                                        value={editData.new_user ?? ""}
                                                        onChange={(e) => handleEditChange("new_user", e.target.value)}
                                                    />
                                                ) : (
                                                    item.new_user
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editId === item.id ? (
                                                    <input
                                                        type="text"
                                                        className="w-full text-xs border rounded px-1"
                                                        value={editData.position ?? ""}
                                                        onChange={(e) => handleEditChange("position", e.target.value)}
                                                    />
                                                ) : (
                                                    item.position
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editId === item.id ? (
                                                    <input
                                                        type="text"
                                                        className="w-full text-xs border rounded px-1"
                                                        value={editData.department ?? ""}
                                                        onChange={(e) => handleEditChange("department", e.target.value)}
                                                    />
                                                ) : (
                                                    item.department
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {item.date_created
                                                    ? new Date(item.date_created).toLocaleString(undefined, {
                                                        year: "numeric",
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })
                                                    : "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirm Deletion</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete the selected assigned asset? This action cannot be undone.
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
            </div>
        </>
    );
};
