export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  try {
    const event = req.body;
    const utmifyToken = process.env.UTMIFY_API_TOKEN;

    if (!event || !event.id) return res.status(400).send("Invalid Payload");

    // Formato de data exigido pela Utmify: YYYY-MM-DD HH:MM:SS
    const date = new Date();
    const formattedDate = date.toISOString().replace('T', ' ').substring(0, 19);

    // Só enviamos para a Utmify se o status for PAID (Pago)
    if (event.status === "PAID") {
      const utmifyPayload = {
        orderId: String(event.id),
        platform: "PayEvo",
        paymentMethod: "pix",
        status: "paid", // Status final
        createdAt: formattedDate, // A Utmify recomenda enviar a mesma data de criação se possível
        approvedDate: formattedDate, // DATA DA APROVAÇÃO (Obrigatória para ROI)
        refundedAt: null,
        customer: {
          name: event.customer?.name || "Cliente",
          email: event.customer?.email || "",
          phone: event.customer?.phone?.replace(/\D/g, "") || "",
          document: event.customer?.document?.number?.replace(/\D/g, "") || "",
          country: "BR"
        },
        products: [{
          id: "1", // Tente manter o mesmo ID enviado no checkout
          name: "Pedido Select Wines",
          quantity: 1,
          priceInCents: event.amount
        }],
        trackingParameters: {
          src: null, sck: null, utm_source: null, utm_campaign: null,
          utm_medium: null, utm_content: null, utm_term: null
        },
        commission: {
          totalPriceInCents: event.amount,
          gatewayFeeInCents: event.fee?.estimatedFee || 0,
          userCommissionInCents: event.amount
        }
      };

      await fetch("https://api.utmify.com.br/api-credentials/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": utmifyToken,
        },
        body: JSON.stringify(utmifyPayload),
      });
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error.message);
    return res.status(500).send("Internal Error");
  }
}
