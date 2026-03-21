export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const event = req.body; 
  // A PayEvo envia o objeto da transação no body do postback
  
  const orderId = event.id;
  const statusPayEvo = event.status; // Ex: "PAID", "REFUNDED", "CANCELED"
  
  let utmifyStatus = "waiting_payment";
  let approvedDate = null;
  let refundedAt = null;

  // Tradução de Status PayEvo -> Utmify
  if (statusPayEvo === "PAID") {
    utmifyStatus = "paid";
    approvedDate = new Date().toISOString().replace('T', ' ').split('.')[0];
  } else if (statusPayEvo === "REFUNDED") {
    utmifyStatus = "refunded";
    refundedAt = new Date().toISOString().replace('T', ' ').split('.')[0];
  } else if (statusPayEvo === "CANCELED") {
    utmifyStatus = "refused";
  }

  try {
    // Atualizar Utmify
    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "x-api-token": process.env.UTMIFY_API_TOKEN 
      },
      body: JSON.stringify({
        orderId: String(orderId),
        platform: "PayEvo",
        status: utmifyStatus,
        approvedDate: approvedDate,
        refundedAt: refundedAt,
        // Repetir dados básicos conforme exigido pela API
        customer: {
          email: event.customer.email,
          name: event.customer.name
        },
        // O createdAt deve ser o mesmo da criação, mas a Utmify aceita o update pelo orderId
        createdAt: new Date(event.createdAt).toISOString().replace('T', ' ').split('.')[0],
        commission: {
          totalPriceInCents: event.amount,
          gatewayFeeInCents: 0,
          userCommissionInCents: event.amount
        }
      }),
    });

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Erro Webhook:", err);
    return res.status(500).send("Erro");
  }
}
