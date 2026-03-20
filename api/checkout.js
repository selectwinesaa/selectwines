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
      // UTM params
      utm_source,
      utm_campaign,
      utm_medium,
      utm_content,
      utm_term,
      src,
      sck,
    } = req.body;

    // 1. Criar transação PIX na PayEvo
    const payevoResponse = await fetch("https://api.payevo.com.br/api/v1/transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PAYEVO_API_KEY}`,
      },
      body: JSON.stringify({
        customer: { name, email, phone, cpf },
        amount,
        payment_method: "pix",
        product_name,
      }),
    });

    if (!payevoResponse.ok) {
      const err = await payevoResponse.text();
      console.error("PayEvo error:", err);
      return res.status(500).json({ error: "Erro ao criar transação PayEvo" });
    }

    const payevoData = await payevoResponse.json();
    const orderId = payevoData.transaction_id || payevoData.id;

    // 2. Enviar pedido para Utmify com status waiting_payment
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
          customer: {
            name,
            email,
            phone,
            document: cpf,
          },
          products: [
            {
              id: product_id || "1",
              name: product_name || "Produto",
              planName: null,
              quantity: 1,
              priceInCents: Math.round(amount * 100),
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
            totalPriceInCents: Math.round(amount * 100),
            gatewayFeeInCents: 0,
            userCommissionInCents: Math.round(amount * 100),
            currency: "BRL",
          },
        }),
      });
    } catch (utmifyErr) {
      console.error("Utmify tracking error (non-blocking):", utmifyErr);
    }

    // 3. Retornar dados da transação para o frontend
    return res.status(200).json(payevoData);
  } catch (error) {
    console.error("Checkout error:", error);
    return res.status(500).json({ error: "Erro interno no checkout" });
  }
}
