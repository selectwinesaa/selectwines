export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      name, email, phone, cpf, amount, product_name, product_id,
      utm_source, utm_campaign, utm_medium, utm_content, utm_term, src, sck
    } = req.body;

    // Ajustado para o nome que está no seu print da Vercel
    const secretKey = process.env.PAYEVO_SECRET_KEY;
    const utmifyToken = process.env.UTMIFY_API_TOKEN;

    if (!secretKey) {
      return res.status(500).json({ error: "PAYEVO_SECRET_KEY não configurada na Vercel" });
    }

    const basicAuth = Buffer.from(secretKey).toString("base64");

    // 1. Criar transação na PayEvo
    const payevoResponse = await fetch("https://apiv2.payevo.com.br/functions/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + basicAuth,
      },
      body: JSON.stringify({
        customer: {
          name,
          email,
          phone,
          document: { number: cpf, type: "CPF" },
        },
        paymentMethod: "PIX",
        pix: { expiresInDays: 1 },
        items: [{
          name: product_name || "Produto",
          quantity: 1,
          amount: amount,
        }],
        amount: amount,
        // Altere para a URL real do seu projeto para o webhook funcionar
        postbackUrl: "https://selectwines.online/api/webhook-payevo", 
        description: product_name || "Pedido",
      }),
    });

    const payevoData = await payevoResponse.json();
    if (!payevoResponse.ok) throw new Error("Erro na PayEvo");

    // 2. Enviar para Utmify (Status: waiting_payment)
    try {
      const now = new Date().toISOString().replace('T', ' ').split('.')[0];
      
      await fetch("https://api.utmify.com.br/api-credentials/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": utmifyToken,
        },
        body: JSON.stringify({
          orderId: String(payevoData.id),
          platform: "PayEvo",
          paymentMethod: "pix",
          status: "waiting_payment",
          createdAt: now,
          approvedDate: null,
          refundedAt: null,
          customer: { name, email, phone, document: cpf },
          products: [{
            id: String(product_id || "1"),
            name: product_name || "Produto",
            quantity: 1,
            priceInCents: amount,
          }],
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
          },
        }),
      });
    } catch (utmErr) {
      console.error("Erro Utmify (Non-blocking):", utmErr);
    }

    return res.status(200).json(payevoData);
  } catch (error) {
    console.error("Checkout Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
