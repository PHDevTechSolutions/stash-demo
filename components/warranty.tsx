"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableHeader,
    TableRow,
    TableCell,
    TableHead,
} from "@/components/ui/table";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge"
import { type DateRange } from "react-day-picker";
import { toast } from "sonner";

import { supabase } from "@/utils/supabase"; // Adjust path accordingly

interface WarrantyItem {
    id: string; // supabase uses 'id' by default (uuid or int)
    asset_tag?: string;
    asset_type?: string;
    brand?: string;
    model?: string;
    serial_number?: string;
    warranty_date?: string;
    purchase_date?: string;
    remarks?: string;
    date_created?: string;
}

interface WarrantyProps {
    referenceid: string;
    dateCreatedFilterRange: DateRange | undefined;
    setDateCreatedFilterRangeAction: React.Dispatch<
        React.SetStateAction<DateRange | undefined>
    >;
}

const PAGE_SIZE = 20;

export const Warranty: React.FC<WarrantyProps> = ({
    referenceid,
    dateCreatedFilterRange,
}) => {
    const [activities, setActivities] = useState<WarrantyItem[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [errorActivities, setErrorActivities] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const fetchActivities = useCallback(async () => {
        if (!referenceid) {
            setActivities([]);
            return;
        }
        setLoadingActivities(true);
        setErrorActivities(null);

        try {
            const { data, error } = await supabase
                .from("inventory")
                .select("*")
                .eq("referenceid", referenceid)
                .order("date_created", { ascending: false });

            if (error) throw error;

            setActivities(data ?? []);
        } catch (error: any) {
            setErrorActivities(error.message || "Error fetching activities");
            toast.error(error.message || "Error fetching activities");
        } finally {
            setLoadingActivities(false);
        }
    }, [referenceid]);

    useEffect(() => {
        fetchActivities();
    }, [referenceid, fetchActivities]);

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
                    const newRecord = payload.new as WarrantyItem;
                    const oldRecord = payload.old as WarrantyItem;

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


    // Filter & paginate
    const filteredActivities = useMemo(() => {
        if (!activities.length) return [];

        // Prepare start and end date bounds for filtering
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
            const matchesSearch =
                search.trim() === "" ||
                Object.values(item).some((val) =>
                    val?.toString().toLowerCase().includes(search.toLowerCase())
                );

            if (!matchesSearch) return false;

            if (startDate || endDate) {
                if (!item.purchase_date) return false;

                const itemDate = new Date(item.purchase_date);
                if (isNaN(itemDate.getTime())) return false;

                if (startDate && itemDate < startDate) return false;
                if (endDate && itemDate > endDate) return false;
            }

            return true;
        });
    }, [activities, search, dateCreatedFilterRange]);

    const pageCount = Math.ceil(filteredActivities.length / PAGE_SIZE);

    const paginatedActivities = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredActivities.slice(start, start + PAGE_SIZE);
    }, [filteredActivities, page]);

    const exportToCSV = () => {
        if (!filteredActivities.length) {
            toast.error("No data to export");
            return;
        }

        const headers = [
            "Asset Tag",
            "Asset Type",
            "Brand",
            "Model",
            "Serial Number",
            "Purchase Date",
            "Warranty Date",
            "Warranty Status",
            "Days Remaining",
            "Remarks",
        ];

        const rows = filteredActivities.map((item) => {
            const warrantyInfo = getWarrantyInfo(item.warranty_date);

            return [
                item.asset_tag ?? "",
                item.asset_type ?? "",
                item.brand ?? "",
                item.model ?? "",
                item.serial_number ?? "",
                item.purchase_date
                    ? new Date(item.purchase_date).toLocaleDateString()
                    : "",
                item.warranty_date
                    ? new Date(item.warranty_date).toLocaleDateString()
                    : "",
                warrantyInfo.status,
                warrantyInfo.days,
                item.remarks ?? "",
            ];
        });

        const csvContent =
            [headers, ...rows]
                .map((row) =>
                    row
                        .map((cell) =>
                            `"${String(cell).replace(/"/g, '""')}"`
                        )
                        .join(",")
                )
                .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `warranty-export-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();

        URL.revokeObjectURL(url);
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

    const getWarrantyInfo = (warrantyDateStr?: string) => {
        if (!warrantyDateStr) {
            return { status: "no set purchase date", days: "-" };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const warrantyDate = new Date(warrantyDateStr);
        warrantyDate.setHours(0, 0, 0, 0);

        const diffMs = warrantyDate.getTime() - today.getTime();
        const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (remainingDays > 0) {
            return {
                status: "Warranty Covered",
                days: remainingDays + " days",
            };
        }

        return {
            status: "Out of Warranty / Expired",
            days: "0 days",
        };
    };

    return (
        <Card className="w-full p-4 rounded-xl flex flex-col">
            <CardHeader className="p-0 mb-2">
                <div className="flex items-center justify-between space-x-4">
                    <Input
                        placeholder="Search warranty..."
                        className="text-xs flex-grow max-w-[400px]"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                    />
                    <button
                        onClick={exportToCSV}
                        className="text-xs px-3 py-2 border rounded-md hover:bg-muted"
                    >
                        Download CSV
                    </button>
                </div>
            </CardHeader>

            {loadingActivities ? (
                <div className="flex justify-center py-10">
                    <Spinner />
                </div>
            ) : filteredActivities.length === 0 ? (
                <div className="text-muted-foreground text-sm p-3 border rounded-lg text-center">
                    No warranty data available.
                </div>
            ) : (
                <>
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Asset Tag</TableHead>
                                <TableHead>Asset Type</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead>Model</TableHead>
                                <TableHead>Serial Number</TableHead>
                                <TableHead>Purchased Date</TableHead>
                                <TableHead>Warranty Date</TableHead>
                                <TableHead>Warranty Status</TableHead>
                                <TableHead>Days Remaining</TableHead>
                                <TableHead>Remarks</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedActivities.map((item) => (
                                <TableRow key={item.id} className="odd:bg-white even:bg-gray-50">
                                    <TableCell>{item.asset_tag || "-"}</TableCell>
                                    <TableCell>{item.asset_type || "-"}</TableCell>
                                    <TableCell>{item.brand || "-"}</TableCell>
                                    <TableCell>{item.model || "-"}</TableCell>
                                    <TableCell>{item.serial_number || "-"}</TableCell>
                                    <TableCell>
                                        {item.purchase_date
                                            ? new Date(item.purchase_date).toLocaleDateString()
                                            : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {item.warranty_date
                                            ? new Date(item.warranty_date).toLocaleDateString()
                                            : "-"}
                                    </TableCell>
                                    <TableCell className="capitalize"><Badge>{getWarrantyInfo(item.warranty_date).status}</Badge></TableCell>
                                    <TableCell>{getWarrantyInfo(item.warranty_date).days}</TableCell>
                                    <TableCell className="capitalize">{item.remarks || "-"}</TableCell>
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

                                <div className="px-4 font-medium">
                                    {pageCount === 0 ? "0 / 0" : `${page} / ${pageCount}`}
                                </div>

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
        </Card>
    );
};
