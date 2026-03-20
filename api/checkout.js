export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      name,
      email,
      phone,
      cpf,
      amount,
      product_name,
      product_id,
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term,
      src,
      sck,
    } = req.body;

    // Basic Auth conforme documentação PayEvo
    const basicAuth = Buffer.from(process.env.PAYEVO_API_KEY).toString("base64");

    const payevoBody = {
      customer: {
        name,
        email,
        phone,
        document: {
          number: cpf,
          type: "CPF",
        },
      },
      paymentMethod: "PIX",
      pix: {
        expiresInDays: 1,
      },
      items: [
        {
          name: product_name || "Produto",
          quantity: 1,
          amount: amount,
        },
      ],
      amount: amount,
      postbackUrl: "https://selectwines.online/api/webhook-payevo",
      description: product_name || "Pedido Select Wines",
    };

    console.log("PayEvo request:", JSON.stringify(payevoBody));

    const payevoResponse = await fetch(
      "https://apiv2.payevo.com.br/functions/v1/transactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + basicAuth,
        },
        body: JSON.stringify(payevoBody),
      }
    );

    if (!payevoResponse.ok) {
      const err = await payevoResponse.text();
      console.error("PayEvo status:", payevoResponse.status);
      console.error("PayEvo response:", err);
      return res.status(500).json({
        error: "Erro ao criar transação PayEvo",
        details: err,
        status: payevoResponse.status,
      });
    }

    const payevoData = await payevoResponse.json();
    const orderId = payevoData.id;

    // Enviar pedido para Utmify com status waiting_payment
    try {
      await fetch("https://api.utmify.com.br/api-credentials/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": process.env.UTMIFY_API_TOKEN,
        },
        body: JSON.stringify({
          orderId: String(orderId),
          platform: "PayEvo",
          paymentMethod: "pix",
          status: "waiting_payment",
          createdAt: new Date().toISOString(),
          approvedDate: null,
          refundedAt: null,
          customer: { name, email, phone, document: cpf },
          products: [
            {
              id: product_id || "1",
              name: product_name || "Produto",
              planName: null,
              quantity: 1,
              priceInCents: amount,
            },
          ],
          trackingParameters: {
            src: src || null,
            sck: sck || null,
            utm_source: utm_source || null,
            utm_campaign: utm_campaign || null,
            utm_medium: utm_medium || null,
            utm_content: utm_content || null,
            utm_term: utm_term || null,
          },
          commission: {
            totalPriceInCents: amount,
            gatewayFeeInCents: 0,
            userCommissionInCents: amount,
            currency: "BRL",
          },
        }),
      });
    } catch (utmifyErr) {
      console.error("Utmify tracking error (non-blocking):", utmifyErr);
    }

    return res.status(200).json(payevoData);
  } catch (error) {
    console.error("Checkout error:", error);
    return res.status(500).json({ error: "Erro interno no checkout" });
  }
}
