import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

function generateAssignedNumber() {
    const date = new Date();
    const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(1000 + Math.random() * 9000); // 4 digits
    return `ASN-${ymd}-${rand}`;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const {
        referenceid,
        new_user,
        old_user,
        position,
        department,
        items,
    } = req.body;

    if (!referenceid || !new_user || !position || !department || !items?.length) {
        return res.status(400).json({ error: "Incomplete payload" });
    }

    try {
        // ✅ 1️⃣ GENERATE ONE ASSIGNED NUMBER
        const assigned_number = generateAssignedNumber();

        // ✅ 2️⃣ INSERT ASSIGNMENT LOG (SAME assigned_number)
        const { error: logError } = await supabase
            .from("assign_asset")
            .insert(
                items.map((item: any) => ({
                    assigned_number, // ⭐ SAME FOR ALL
                    referenceid,
                    inventory_id: item.inventory_id,
                    asset_tag: item.asset_tag,
                    asset_type: item.asset_type,
                    brand: item.brand,
                    model: item.model,
                    serial_number: item.serial_number,
                    additional_type: item.additional_type,
                    quantity: item.quantity,
                    new_user,
                    old_user,
                    position,
                    department,
                    status: "Deployed",
                }))
            );

        if (logError) throw logError;

        // ✅ 3️⃣ UPDATE INVENTORY STATUS
        const inventoryIds = items.map((i: any) => i.inventory_id);

        const { error: updateError } = await supabase
            .from("inventory")
            .update({ status: "Deployed", new_user, old_user })
            .in("id", inventoryIds);

        if (updateError) throw updateError;

        // ✅ 4️⃣ RETURN assigned_number
        return res.status(200).json({
            success: true,
            assigned_number,
        });

    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}
