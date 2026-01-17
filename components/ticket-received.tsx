"use client";

import { useEffect, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface RequestItem {
  id: string;
  ticket_id: string;
  requestor_name: string;
  ticket_subject: string;
  department: string;
  request_type: string;
  type_concern: string;
  mode: string;
  group_services: string;
  technician_name: string;
  site: string;
  priority: string;
  status: string;
  date_scheduled: string;
  remarks: string;
  processed_by: string;
  closed_by: string;
  date_created?: string;
  date_closed?: string;
}

const STORAGE_KEY = "stash_popup_ticket_hash";

function hashTickets(tickets: RequestItem[]) {
  return tickets.map(t => t.id).sort().join(",");
}

export function PopUp() {
  const [activities, setActivities] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const isoTodayStart = todayStart.toISOString();

      const { data, error } = await supabase
        .from("tickets")
        .select("*")
        .gte("date_created", isoTodayStart)
        .in("request_type", ["Maintenance", "Dispose"])
        .order("date_created", { ascending: false });

      if (error) throw error;

      console.log("Fetched tickets:", data);

      setActivities(data ?? []);

      const storedHash = localStorage.getItem(STORAGE_KEY) || "";
      const currentHash = hashTickets(data ?? []);

      console.log("Stored Hash:", storedHash);
      console.log("Current Hash:", currentHash);
      console.log("Tickets count:", data?.length ?? 0);

      // For debugging: force popup open to test display
      // setOpen(true);

      // Show popup if tickets exist AND hash changed (new tickets)
      if ((data?.length ?? 0) > 0 && storedHash !== currentHash) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    } catch (error: any) {
      setError(error.message || "Error fetching tickets");
      toast.error(error.message || "Error fetching tickets");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      const currentHash = hashTickets(activities);
      console.log("Saving hash on close:", currentHash);
      localStorage.setItem(STORAGE_KEY, currentHash);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {!open && (
        <Dialog.Trigger asChild>
          <Button variant="outline" disabled={loading}>
            {loading ? "Loading tickets..." : "Show Today's Tickets"}
          </Button>
        </Dialog.Trigger>
      )}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-[15%] left-1/2 max-h-[75vh] w-[90vw] max-w-lg -translate-x-1/2 rounded-lg bg-white p-8 shadow-xl focus:outline-none overflow-auto">
          <Dialog.Title className="text-2xl font-bold mb-6 text-gray-900">
            Tickets for Maintenance or Dispose Today
          </Dialog.Title>
          <Dialog.Description className="mb-6 text-gray-700">
            {error ? (
              <p className="text-red-600">{error}</p>
            ) : activities.length === 0 ? (
              <p className="text-gray-500">No tickets found.</p>
            ) : (
              <p>
                Here are <strong>{activities.length}</strong> tickets created
                today:
              </p>
            )}
          </Dialog.Description>

          <div className="space-y-4 max-h-72 overflow-y-auto">
            {activities.map((ticket) => (
              <div
                key={ticket.id}
                className="border border-gray-200 rounded-md p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-lg font-semibold text-gray-900">
                  {ticket.ticket_subject}
                </p>
                <p className="text-sm text-gray-600">
                  Requestor: {ticket.requestor_name}
                </p>
                <p className="text-sm text-gray-600">
                  Date Created:{" "}
                  {ticket.date_created
                    ? new Date(ticket.date_created).toLocaleString()
                    : "-"}
                </p>
                <p className="text-sm text-gray-600">
                  Request Type: {ticket.request_type}
                </p>
              </div>
            ))}
          </div>

          <Dialog.Close asChild>
            <Button className="mt-6 w-full" variant="secondary">
              Close
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
