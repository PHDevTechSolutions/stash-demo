import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", ["POST"]);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { subscriptions, customEmails } = req.body;

    if (!subscriptions || !Array.isArray(subscriptions) || subscriptions.length === 0) {
        return res.status(400).json({ error: "No subscriptions provided" });
    }

    const defaultEmail = process.env.DEFAULT_NOTIFICATION_EMAIL || "it.ecoshiftcorp@gmail.com";
    const recipients   = [defaultEmail, ...(customEmails || [])].filter(Boolean);

    const listHtml = subscriptions.map((s: any) => `
        <li style="margin-bottom:12px;padding:12px;border:1px solid #1e293b;background:#0f172a;border-radius:6px;">
            <strong style="color:#38bdf8;font-size:15px;">${s.service_name}</strong>
            ${s.plan ? `<span style="color:#64748b;margin-left:8px;">(${s.plan})</span>` : ""}
            <br/>
            <span style="color:#94a3b8;">Billing: ${s.billing_cycle || "—"}</span>
            ${s.amount != null ? `<span style="color:#94a3b8;margin-left:12px;">Amount: ${s.currency ?? ""} ${s.amount}</span>` : ""}
            <br/>
            <span style="color:${s.diffDays <= 3 ? "#f87171" : s.diffDays <= 7 ? "#fbbf24" : "#34d399"};font-weight:bold;">
                Renews in ${s.diffDays} day${s.diffDays !== 1 ? "s" : ""} — ${new Date(s.renewal_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
        </li>
    `).join("");

    try {
        const { data, error } = await resend.emails.send({
            from: "Stash Monitoring <no-reply@elev8solutions.cloud>",
            to: recipients,
            subject: `⚠️ SERVICE RENEWAL ALERT — ${subscriptions.length} subscription${subscriptions.length > 1 ? "s" : ""} expiring soon`,
            html: `
                <div style="font-family:'Courier New',monospace;max-width:600px;margin:0 auto;background:#0a0f1e;border:1px solid #1e3a5f;padding:24px;color:#e2e8f0;">
                    <h2 style="color:#38bdf8;letter-spacing:2px;text-transform:uppercase;font-size:14px;border-bottom:1px solid #1e3a5f;padding-bottom:12px;">
                        🔔 Service Subscription Renewal Alert
                    </h2>
                    <p style="color:#94a3b8;font-size:12px;">
                        The following service subscriptions are due for renewal within the next 7 days. Please take action to avoid service interruption.
                    </p>
                    <ul style="list-style:none;padding:0;margin:16px 0;">
                        ${listHtml}
                    </ul>
                    <hr style="border:0;border-top:1px solid #1e3a5f;margin:20px 0;"/>
                    <p style="font-size:11px;color:#475569;">
                        This is an automated notification from <strong style="color:#38bdf8;">Stash IT Asset Management System</strong>.<br/>
                        Sent: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })} PHT
                    </p>
                </div>
            `,
        });

        if (error) {
            console.error("Resend error:", error);
            return res.status(400).json({ error: error.message });
        }

        res.status(200).json({ message: "Subscription alerts sent", data });
    } catch (err: any) {
        console.error("Error sending subscription alert:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
