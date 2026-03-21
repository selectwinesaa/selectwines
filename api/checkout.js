export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      nome, sobrenome, email, telefone, cpf, totalPrice, 
      product_name, product_id, utm_source, utm_campaign, 
      utm_medium, utm_content, utm_term, src, sck
    } = req.body;

    const secretKey = process.env.PAYEVO_SECRET_KEY;
    const utmifyToken = process.env.UTMIFY_API_TOKEN;

    // 1. Tratamento de valores e strings
    const valueInCents = Math.floor(parseFloat(totalPrice) * 100);
    const basicAuth = Buffer.from(secretKey).toString("base64");
    const nomeCompleto = `${nome} ${sobrenome || ""}`.trim();
    const cleanCpf = String(cpf).replace(/\D/g, "");
    const cleanPhone = String(telefone).replace(/\D/g, "");

    // 2. Chamada PayEvo
    const payevoResponse = await fetch("https://apiv2.payevo.com.br/functions/v1/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + basicAuth,
      },
      body: JSON.stringify({
        customer: {
          name: nomeCompleto,
          email: email,
          phone: cleanPhone,
          document: { number: cleanCpf, type: "CPF" },
        },
        paymentMethod: "PIX",
        pix: { expiresInDays: 1 },
        items: [{
          title: product_name || "Pedido Select Wines",
          unitPrice: valueInCents,
          quantity: 1,
          externalRef: String(product_id || "PROD_01"),
        }],
        amount: valueInCents,
        postbackUrl: "https://selectwines.vercel.app/api/webhook-payevo",
        description: product_name || "Compra Select Wines",
      }),
    });

    const payevoData = await payevoResponse.json();
    if (!payevoResponse.ok) return res.status(payevoResponse.status).json(payevoData);

    // 3. Chamada Utmify (Ajustada conforme Seção 1.3 da sua Doc)
    try {
      // Formato exigido: YYYY-MM-DD HH:MM:SS (Seção 2.2 da Doc)
      const date = new Date();
      const createdAtFormat = date.toISOString().replace('T', ' ').substring(0, 19);

      const utmifyPayload = {
        orderId: String(payevoData.id),
        platform: "PayEvo",
        paymentMethod: "pix",
        status: "waiting_payment",
        createdAt: createdAtFormat,
        approvedDate: null,
        refundedAt: null,
        customer: { 
          name: nomeCompleto, 
          email: email, 
          phone: cleanPhone, 
          document: cleanCpf,
          country: "BR"
        },
        products: [{
          id: String(product_id || "1"),
          name: product_name || "Produto",
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents: valueInCents,
        }],
        trackingParameters: {
          src: src || null,
          sck: sck || null,
          utm_source: utm_source || null,
          utm_campaign: utm_campaign || null,
          utm_medium: utm_medium || null,
          utm_content: utm_content || null,
          utm_term: utm_term || null
        },
        commission: {
          totalPriceInCents: valueInCents,
          gatewayFeeInCents: 0,
          userCommissionInCents: valueInCents // Conforme Seção 2.6: igual ao total se não informado
        },
        isTest: false
      };

      const utmifyRes = await fetch("https://api.utmify.com.br/api-credentials/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": utmifyToken,
        },
        body: JSON.stringify(utmifyPayload),
      });

      if (!utmifyRes.ok) {
        const errorText = await utmifyRes.text();
        console.error("Erro Utmify:", errorText);
      }
    } catch (utmErr) {
      console.error("Erro Conexão Utmify:", utmErr.message);
    }

    return res.status(200).json(payevoData);

  } catch (error) {
    return res.status(500).json({ error: "Erro interno", message: error.message });
  }
}
