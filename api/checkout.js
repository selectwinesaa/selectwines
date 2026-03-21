export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      name, email, phone, cpf, amount, product_name, product_id,
      utm_source, utm_campaign, utm_medium, utm_content, utm_term, src, sck
    } = req.body;

    const secretKey = process.env.PAYEVO_SECRET_KEY;
    const utmifyToken = process.env.UTMIFY_API_TOKEN;

    if (!secretKey) return res.status(500).json({ error: "Configuração ausente na Vercel" });

    const basicAuth = Buffer.from(secretKey).toString("base64");
    const valueInCents = parseInt(amount); // Certifique-se que vem em centavos (ex: 5000 para R$50)

    // 1. Chamada para PayEvo com os nomes de campos EXATOS da sua doc
    const payevoResponse = await fetch("https://apiv2.payevo.com.br/functions/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + basicAuth,
      },
      body: JSON.stringify({
        customer: {
          name: name,
          email: email,
          phone: phone.replace(/\D/g, ''), // Apenas números
          document: { 
            number: cpf.replace(/\D/g, ''), // Apenas números
            type: "CPF" 
          },
        },
        paymentMethod: "PIX",
        pix: { 
          expiresInDays: 1 // Campo obrigatório conforme seu print
        },
        items: [{
          title: product_name || "Produto", // Doc pede 'title', não 'name'
          unitPrice: valueInCents,          // Doc pede 'unitPrice', não 'amount'
          quantity: 1,
          externalRef: String(product_id || "PROD001") // Campo obrigatório na doc
        }],
        amount: valueInCents,
        postbackUrl: "https://selectwines.online/api/webhook-payevo", 
        description: product_name || "Pedido Select Wines",
      }),
    });

    const payevoData = await payevoResponse.json();

    if (!payevoResponse.ok) {
      console.error("PayEvo Error Details:", payevoData);
      return res.status(payevoResponse.status).json({ 
        error: "PayEvo recusou a transação", 
        details: payevoData 
      });
    }

    // 2. Enviar para Utmify (Status: waiting_payment)
    try {
      const nowUtmify = new Date().toISOString().replace('T', ' ').split('.')[0];
      await fetch("https://api.utmify.com.br/api-credentials/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-token": utmifyToken },
        body: JSON.stringify({
          orderId: String(payevoData.id),
          platform: "PayEvo",
          paymentMethod: "pix",
          status: "waiting_payment",
          createdAt: nowUtmify,
          approvedDate: null,
          refundedAt: null,
          customer: { name, email, phone, document: cpf },
          products: [{
            id: String(product_id || "1"),
            name: product_name || "Produto",
            quantity: 1,
            priceInCents: valueInCents,
          }],
          trackingParameters: { src, sck, utm_source, utm_campaign, utm_medium, utm_content, utm_term },
          commission: {
            totalPriceInCents: valueInCents,
            gatewayFeeInCents: 0,
            userCommissionInCents: valueInCents,
          },
        }),
      });
    } catch (utmErr) {
      console.error("Erro Utmify (Non-blocking):", utmErr);
    }

    return res.status(200).json(payevoData);

  } catch (error) {
    console.error("Checkout Global Error:", error);
    return res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
}
