export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { 
      name, email, phone, cpf, amount, product_name, product_id, 
      utm_source, utm_campaign, utm_medium, utm_content, utm_term, src, sck 
    } = req.body;

    const secretKey = process.env.PAYEVO_API_KEY;
    const basicAuth = Buffer.from(secretKey).toString("base64");

    // 1. Criar Transação na PayEvo
    const payevoResponse = await fetch("https://apiv2.payevo.com.br/functions/v1/transactions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": "Basic " + basicAuth 
      },
      body: JSON.stringify({
        customer: { name, email, phone, document: { number: cpf, type: "CPF" } },
        paymentMethod: "PIX",
        pix: { expiresInDays: 1 },
        items: [{ name: product_name || "Produto", quantity: 1, amount: amount }],
        amount: amount,
        postbackUrl: "https://seu-dominio.com/api/webhook-payevo", // URL do passo 2
        description: product_name
      }),
    });

    const payevoData = await payevoResponse.json();
    if (!payevoResponse.ok) throw new Error("Erro PayEvo");

    // 2. Notificar Utmify: Venda Pendente
    await fetch("https://api.utmify.com.br/api-credentials/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": process.env.UTMIFY_API_TOKEN },
      body: JSON.stringify({
        orderId: String(payevoData.id),
        platform: "PayEvo",
        paymentMethod: "pix",
        status: "waiting_payment",
        createdAt: new Date().toISOString().replace('T', ' ').split('.')[0], // Formato YYYY-MM-DD HH:MM:SS
        approvedDate: null,
        refundedAt: null,
        customer: { name, email, phone, document: cpf },
        products: [{ id: String(product_id), name: product_name, quantity: 1, priceInCents: amount }],
        trackingParameters: { src, sck, utm_source, utm_campaign, utm_medium, utm_content, utm_term },
        commission: { totalPriceInCents: amount, gatewayFeeInCents: 0, userCommissionInCents: amount }
      }),
    });

    return res.status(200).json(payevoData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
