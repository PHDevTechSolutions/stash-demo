import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Destructure incoming data, adjust fields as needed
    const {
      referenceid,
      asset_tag,
      asset_type,
      status,
      location,
      new_user,
      old_user,
      department,
      position,
      brand,
      model,
      processor,
      ram,
      storage,
      serial_number,
      purchase_date,
      warranty_date,
      asset_age,
      amount,
      remarks,
      mac_address,
    } = req.body;

    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const newItem = {
      referenceid: referenceid || null,
      asset_tag: asset_tag || null,
      asset_type: asset_type || null,
      status,
      location: location || null,
      new_user: new_user || null,
      old_user: old_user || null,
      department: department || null,
      position: position || null,
      brand: brand || null,
      model: model || null,
      processor: processor || null,
      ram: ram || null,
      storage: storage || null,
      serial_number: serial_number || null,
      purchase_date: purchase_date ? new Date(purchase_date).toISOString() : null,
      warranty_date: warranty_date ? new Date(warranty_date).toISOString() : null,
      asset_age: asset_age || null,
      amount: amount || null,
      remarks: remarks || null,
      mac_address: mac_address || null,
      date_created: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("inventory").insert(newItem);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ message: "Inventory item created", data });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
