/**
 * Shared inventory type definitions.
 * Extracted here to avoid circular imports between inventory.tsx,
 * inventory-dialog.tsx, and the bulk PDF utility.
 */

export interface InventoryItem {
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
