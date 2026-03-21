export default async function handler(req, res) {
  // O Webhook da PayEvo envia um POST. Se alguém acessar via navegador (GET), damos erro amigável.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Apenas POST é permitido neste endpoint." });
  }

  try {
    const event = req.body;

    // Log para você ver exatamente o que a PayEvo está enviando (olhe nos Logs da Vercel)
    console.log("PayEvo Webhook Received:", JSON.stringify(event));

    // Validação básica: se não tiver ID, a requisição é inválida
    if (!event || !event.id) {
      return res.status(400).json({ error: "Payload inválido ou vazio" });
    }

    const utmifyToken = process.env.UTMIFY_API_TOKEN;
    const orderId = String(event.id);
    const statusPayEvo = event.status; // Esperado: PAID, REFUNDED, CANCELED, etc.
    const amount = event.amount;

    // Configuração de Status para Utmify
    let utmifyStatus = "waiting_payment";
    let approvedDate = null;
    let refundedAt = null;

    // Formato de data da Utmify: YYYY-MM-DD HH:MM:SS
    const now = new Date().toISOString().replace("T", " ").split(".")[0];

    if (statusPayEvo === "PAID") {
      utmifyStatus = "paid";
      approvedDate = now;
    } else if (statusPayEvo === "REFUNDED") {
      utmifyStatus = "refunded";
      refundedAt = now;
    } else if (statusPayEvo === "CANCELED" || statusPayEvo === "REFUSED") {
      utmifyStatus = "refused";
    }

    // Enviar atualização para Utmify
    const utmifyResponse = await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": utmifyToken,
      },
      body: JSON.stringify({
        orderId: orderId,
        platform: "PayEvo",
        status: utmifyStatus,
        createdAt: now, // Opcional: Idealmente seria a data de criação original
        approvedDate: approvedDate,
        refundedAt: refundedAt,
        customer: {
          name: event.customer?.name || "Cliente",
          email: event.customer?.email || "",
          phone: event.customer?.phone || "",
          document: event.customer?.document?.number || ""
        },
        commission: {
          totalPriceInCents: amount,
          gatewayFeeInCents: 0,
          userCommissionInCents: amount
        }
      }),
    });

    // Log do resultado da Utmify
    const utmifyData = await utmifyResponse.text();
    console.log("Utmify Response Status:", utmifyResponse.status, utmifyData);

    // Responder 200 para a PayEvo parar de tentar enviar
    return res.status(200).send("Webhook Processed OK");

  } catch (error) {
    console.error("Webhook Critical Error:", error.message);
    // Retornamos 500 para sabermos que algo quebrou no nosso código
    return res.status(500).json({ error: "Internal Error", message: error.message });
  }
}
