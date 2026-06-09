import { NextApiRequest, NextApiResponse } from "next";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { domains, customEmails } = req.body;

  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: "No domains provided for notification" });
  }

  const defaultEmail = process.env.DEFAULT_NOTIFICATION_EMAIL || "it.ecoshiftcorp@gmail.com";
  const recipients = [defaultEmail, ...(customEmails || [])].filter(Boolean);

  try {
    const domainListHtml = domains.map(d => `
      <li style="margin-bottom: 10px; padding: 10px; border-bottom: 1px solid #eee;">
        <strong style="color: #333;">${d.domain}</strong><br/>
        <span style="color: #666;">Registrar: ${d.source.toUpperCase()}</span><br/>
        <span style="color: ${d.isCritical ? '#f87171' : '#fbbf24'}; font-weight: bold;">
          Expires in ${d.diffDays} days (${new Date(d.expires).toLocaleDateString()})
        </span>
      </li>
    `).join("");

    const { data, error } = await resend.emails.send({
      from: "Stash Monitoring <no-reply@elev8solutions.cloud>",
      to: recipients,
      subject: "⚠️ DOMAIN EXPIRATION ALERT - Stash Monitoring",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #f87171;">Domain Expiration Alert</h2>
          <p>The following domains are expiring soon and require your attention:</p>
          <ul style="list-style: none; padding: 0;">
            ${domainListHtml}
          </ul>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="font-size: 12px; color: #999;">This is an automated notification from Stash IT Asset Management System.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ message: "Email notifications sent successfully", data });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
