"use client";

import React, { useEffect, useRef } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface TicketDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    editingId?: string | null;
    form: Record<string, any>;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSelectChange: (name: string, value: string) => void;
    handleSubmit: () => void;
    handleUpdate: () => void;
    resetForm: () => void;
    fullname: string;
    existingTicketIds: string[];
}

function generateTicketID(existingTicketIds: string[]): string {
    const prefix = "DSI";

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const datePart = `${year}-${month}-${day}`;

    const todayIds = existingTicketIds.filter(id => id.startsWith(`${prefix}-${datePart}`));

    let maxSeq = 0;
    for (const id of todayIds) {
        const parts = id.split("-");
        const seqStr = parts[4];  // <-- Fix here
        const seqNum = parseInt(seqStr, 10);
        if (!isNaN(seqNum) && seqNum > maxSeq) {
            maxSeq = seqNum;
        }
    }

    const nextSeq = String(maxSeq + 1).padStart(3, "0");

    return `${prefix}-${datePart}-${nextSeq}`;
}

function toDateTimeLocalString(isoString?: string): string {
    if (!isoString) return "";

    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hour}:${minute}`;
}

// Convert local datetime string back to ISO timestamp (UTC)
function toISOStringFromLocalDateTime(localDateTime: string): string {
    // localDateTime format: yyyy-MM-ddTHH:mm
    const date = new Date(localDateTime);
    return date.toISOString();
}


export const ReceivedDialog: React.FC<TicketDialogProps> = ({
    open,
    setOpen,
    editingId,
    form,
    handleInputChange,
    handleSelectChange,
    handleSubmit,
    handleUpdate,
    resetForm,
    fullname,
    existingTicketIds
}) => {

    const initializedRef = useRef(false);

    useEffect(() => {
        if (open && !editingId && !initializedRef.current) {
            // Only run once per open

            // Generate new ticket ID
            const newTicketId = generateTicketID(existingTicketIds);
            handleInputChange({
                target: { name: "ticket_id", value: newTicketId },
            } as React.ChangeEvent<HTMLInputElement>);

            // Set processed_by if empty
            if (!form.processed_by) {
                handleInputChange({
                    target: { name: "processed_by", value: fullname },
                } as React.ChangeEvent<HTMLInputElement>);
            }

            if (!form.technician_name) {
                handleInputChange({
                    target: { name: "technician_name", value: fullname },
                } as React.ChangeEvent<HTMLInputElement>);
            }

            if (!form.closed_by) {
                handleInputChange({
                    target: { name: "closed_by", value: fullname },
                } as React.ChangeEvent<HTMLInputElement>);
            }

            initializedRef.current = true;
        }

        // Reset flag when sheet closes
        if (!open) {
            initializedRef.current = false;
        }
    }, [open, editingId, existingTicketIds, fullname, handleInputChange, form.processed_by]);


    const onDateCreatedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const localValue = e.target.value;
        const isoTimestamp = toISOStringFromLocalDateTime(localValue);

        handleInputChange({
            target: { name: "date_created", value: isoTimestamp }
        } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
        <Sheet
            open={open}
            onOpenChange={(open) => {
                setOpen(open);
                if (!open) resetForm();
            }}
        >
            <SheetContent side="right" className="w-[420px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle>
                        {editingId ? "Edit Ticket" : "Add New Ticket"}
                    </SheetTitle>
                    <SheetDescription>
                        Fill out the form below to {editingId ? "update" : "add"} a ticket.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 grid grid-cols-1 gap-4 max-h-[70vh] overflow-auto p-4">

                    <div className="flex flex-col gap-4">
                        <Alert className="p-4">
                            <AlertTitle className="mb-2">Ticket Information</AlertTitle>
                            <AlertDescription className="space-y-2">
                                {/* Ticket ID display */}
                                <div>
                                    <div className="font-semibold text-indigo-900">Ticket ID: {form.ticket_id || "-"}</div>
                                    <Input type="hidden" name="ticket_id" value={form.ticket_id || ""} />
                                </div>

                                {/* Processed By display */}
                                <div>
                                    <div className="font-semibold text-indigo-900">Processed By: {form.processed_by || "-"}</div>
                                    <Input type="hidden" name="processed_by" value={form.processed_by || ""} />
                                </div>

                                {/* Technician Name */}
                                <div>
                                    <div className="font-semibold text-indigo-900">Technician Name: {form.processed_by || "-"}</div>
                                    <Input type="hidden" name="technician_name" value={form.technician_name || ""}
                                    />
                                </div>

                                {/* Closed By */}
                                {form.status === "Resolved" && (
                                <div>
                                    <div className="font-semibold text-indigo-900">Closed By: {form.closed_by || "-"}</div>
                                    <Input type="hidden" name="closed_by" value={form.closed_by || ""}
                                    />
                                </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    </div>

                    {/* Full Name */}
                    <div className="flex flex-col">
                        <label className="mb-1 text-xs font-medium">Full Name</label>
                        <Input
                            name="requestor_name"
                            value={form.requestor_name || ""}
                            onChange={handleInputChange}
                            placeholder="Requester's Full Name"
                            className="capitalize"
                        />
                    </div>

                    {/* Concern Type */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Ticket Subject</label>
                        <Input
                            name="ticket_subject"
                            value={form.ticket_subject || ""}
                            onChange={handleInputChange}
                            placeholder="Ticket Subject"
                            className="capitalize"
                        />
                    </div>

                    {/* Department (SELECT) */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Department</label>

                        <Select
                            value={form.department || ""}
                            onValueChange={(value) =>
                                handleSelectChange("department", value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select department" />
                            </SelectTrigger>

                            <SelectContent className="w-full">
                                <SelectItem value="Admin">Admin</SelectItem>
                                <SelectItem value="Accounting">Accounting</SelectItem>
                                <SelectItem value="Business Development">Business Development</SelectItem>
                                <SelectItem value="Customer Service Representative">Customer Service Representative</SelectItem>
                                <SelectItem value="Engineering">Engineering</SelectItem>
                                <SelectItem value="E-Commerce">E-Commerce</SelectItem>
                                <SelectItem value="Human Resources">Human Resources</SelectItem>
                                <SelectItem value="Information Technology">Information Technology</SelectItem>
                                <SelectItem value="Marketing">Marketing</SelectItem>
                                <SelectItem value="Procurement">Procurement</SelectItem>
                                <SelectItem value="Sales">Sales</SelectItem>
                                <SelectItem value="Warehouse Operations">Warehouse Operations</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Request Type */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Request Type</label>
                        <Select
                            value={form.request_type || ""}
                            onValueChange={(value) =>
                                handleSelectChange("request_type", value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                <SelectItem value="Advisory">Advisory</SelectItem>
                                <SelectItem value="Incident">Incident</SelectItem>
                                <SelectItem value="Maintenance">Maintenance</SelectItem>
                                <SelectItem value="Major Incident">Major Incident</SelectItem>
                                <SelectItem value="Incident / Service Request">Incident / Service Request</SelectItem>
                                <SelectItem value="Request">Request</SelectItem>
                                <SelectItem value="Service Request">Service Request</SelectItem>
                                <SelectItem value="Service Request / Incident">Service Request / Incident</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Concern Type */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Type of Concern</label>
                        <Select
                            value={form.type_concern || ""}
                            onValueChange={(value) =>
                                handleSelectChange("type_concern", value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Concern" />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                <SelectItem value="Incident">Incident</SelectItem>
                                <SelectItem value="Request">Request</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Mode */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Mode</label>
                        <Select
                            value={form.mode || ""}
                            onValueChange={(value) =>
                                handleSelectChange("mode", value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Mode" />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                <SelectItem value="Chat">Chat</SelectItem>
                                <SelectItem value="Email">Email</SelectItem>
                                <SelectItem value="Phone Call">Phone Call</SelectItem>
                                <SelectItem value="System Directory">System Directory ( Ecodesk, Taskflow, Acculog Etc.)</SelectItem>
                                <SelectItem value="Walk In">Walk In</SelectItem>
                                <SelectItem value="Web Form">Web Form</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Group */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Services Group</label>
                        <Select
                            value={form.group_services || ""}
                            onValueChange={(value) =>
                                handleSelectChange("group_services", value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Service Group" />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                <SelectItem value="Service Desk">Service Desk</SelectItem>
                                <SelectItem value="System and Website Services">System and Website Services</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Site */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Site</label>
                        <Select
                            value={form.site || ""}
                            onValueChange={(value) =>
                                handleSelectChange("site", value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Site" />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                <SelectItem value="Disruptive - Primex">Disruptive - Primex</SelectItem>
                                <SelectItem value="Disruptive - J&L">Disruptive - J&L</SelectItem>
                                <SelectItem value="Buildchem - Carmona">Buildchem - Carmona</SelectItem>
                                <SelectItem value="Disruptive - Pasig">Disruptive - Pasig</SelectItem>
                                <SelectItem value="Disruptive - CDO">Disruptive - CDO</SelectItem>
                                <SelectItem value="Disruptive - Cebu">Disruptive - Cebu</SelectItem>
                                <SelectItem value="Disruptive - Davao">Disruptive - Davao</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Priority */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Priority</label>
                        <Select
                            value={form.priority || ""}
                            onValueChange={(value) =>
                                handleSelectChange("priority", value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Site" />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                <SelectItem value="Critical">P-1 - Critical (Response Time 15 Mins Max | Resolved Time 4 Hours Max) </SelectItem>
                                <SelectItem value="High">P-2 - High (Response Time 1 Hour Max | Resolved Time 8 Hours Max) </SelectItem>
                                <SelectItem value="Medium">P-3 - Medium (Response Time 4 Hour Max | Resolved Time 1-2 Days Max) </SelectItem>
                                <SelectItem value="Low">P-4 - Low (Response Time 8 Hour Max | Resolved Time 3-4 Days Max) </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col w-full">
                        <label className="mb-1 text-xs font-medium">Status</label>
                        <Select
                            value={form.status || ""}
                            onValueChange={(value) =>
                                handleSelectChange("status", value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Status" />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Scheduled">Scheduled</SelectItem>
                                <SelectItem value="Ongoing">Ongoing</SelectItem>
                                <SelectItem value="Resolved">Resolved</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Remarks */}
                    <div className="flex flex-col">
                        <label className="mb-1 text-xs font-medium">Remarks</label>
                        <textarea
                            name="remarks"
                            value={form.remarks || ""}
                            onChange={(e) =>
                                handleSelectChange("remarks", e.target.value)
                            }
                            rows={5}
                            placeholder="Remarks"
                            className="rounded-md border border-input bg-background p-2 text-sm resize-none"
                        />
                    </div>

                    {/* Date Scheduled */}
                    {form.status === "Scheduled" && (
                        <div className="flex flex-col w-full mt-2">
                            <label className="mb-1 text-xs font-medium">Date Scheduled</label>
                            <Input
                                type="date"
                                name="date_scheduled"
                                value={form.date_scheduled || ""}
                                onChange={handleInputChange}
                            />
                        </div>
                    )}

                    {/* Date Created */}
                    {form.status !== "Scheduled" && (
                        <div className="flex flex-col w-full mt-2">
                            <label className="mb-1 text-xs font-medium">Date Created</label>
                            <Input
                                type="datetime-local"
                                name="date_created"
                                value={toDateTimeLocalString(form.date_created)}
                                onChange={onDateCreatedChange}
                            />
                        </div>
                    )}

                </div>

                <SheetFooter className="mt-6 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setOpen(false);
                            resetForm();
                        }}
                    >
                        Cancel
                    </Button>
                    <Button onClick={editingId ? handleUpdate : handleSubmit}>
                        {editingId ? "Update" : "Create"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};
