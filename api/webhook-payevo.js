export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Log completo do body para debug
    console.log("Webhook PayEvo body:", JSON.stringify(req.body));

    // Aceitar diferentes formatos de campo
    const transactionId = req.body.id || req.body.transaction_id || req.body.transactionId;
    const status = req.body.status || req.body.currentStatus;

    if (!transactionId || !status) {
      console.error("Missing fields. Body:", JSON.stringify(req.body));
      return res.status(400).json({ error: "Missing transaction id or status" });
    }

    // Mapear status da PayEvo para Utmify (aceita maiúsculo e minúsculo)
    const statusMap = {
      paid: "paid",
      approved: "paid",
      completed: "paid",
      refunded: "refunded",
      chargeback: "refunded",
      canceled: "refunded",
      cancelled: "refunded",
    };

    const utmifyStatus = statusMap[status.toLowerCase()];

    if (!utmifyStatus) {
      console.log(`Status "${status}" não mapeado para Utmify, ignorando.`);
      return res.status(200).json({ message: "Status ignorado" });
    }

    const now = new Date().toISOString();
    const updateBody = {
      orderId: String(transactionId),
      status: utmifyStatus,
    };

    if (utmifyStatus === "paid") {
      updateBody.approvedDate = now;
    } else if (utmifyStatus === "refunded") {
      updateBody.refundedAt = now;
    }

    console.log("Utmify update body:", JSON.stringify(updateBody));

    const utmifyResponse = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": process.env.UTMIFY_API_TOKEN,
      },
      body: JSON.stringify(updateBody),
    });

    if (!utmifyResponse.ok) {
      const err = await utmifyResponse.text();
      console.error("Utmify update error:", err);
      return res.status(500).json({ error: "Erro ao atualizar Utmify" });
    }

    return res.status(200).json({ message: "Webhook processado com sucesso" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Erro interno no webhook" });
  }
}
