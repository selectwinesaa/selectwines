export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      nome, sobrenome, email, telefone, cpf,
      totalPrice, // Exemplo recebido: 118.541
      product_name, product_id,
      utm_source, utm_campaign, utm_medium, utm_content, utm_term, src, sck
    } = req.body;

    // 1. Validação básica
    if (!nome || !email || !cpf || !totalPrice || !telefone) {
      return res.status(400).json({ error: "Dados incompletos no formulário." });
    }

    const secretKey = process.env.PAYEVO_SECRET_KEY;
    const utmifyToken = process.env.UTMIFY_API_TOKEN;

    // 2. Conversão para Centavos (Ajuste para 118.541 -> 11854)
    // Multiplicamos por 100 e usamos Math.floor para ignorar a 3ª casa decimal
    const valueInCents = Math.floor(parseFloat(totalPrice) * 100);

    const basicAuth = Buffer.from(secretKey).toString("base64");
    const nomeCompleto = `${nome} ${sobrenome || ""}`.trim();
    const cleanCpf = String(cpf).replace(/\D/g, "");
    const cleanPhone = String(telefone).replace(/\D/g, "");

    // 3. Chamada PayEvo
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
          unitPrice: valueInCents, // Enviará 11854
          quantity: 1,
          externalRef: String(product_id || "PROD_01"),
        }],
        amount: valueInCents, // Enviará 11854
        postbackUrl: "https://selectwines.online/api/webhook-payevo",
        description: product_name || "Compra Select Wines",
      }),
    });

    const payevoData = await payevoResponse.json();

    if (!payevoResponse.ok) {
      return res.status(payevoResponse.status).json(payevoData);
    }

    // 4. Enviar para Utmify (waiting_payment)
    try {
      const nowUtmify = new Date().toISOString().replace("T", " ").split(".")[0];
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
          createdAt: nowUtmify,
          customer: { name: nomeCompleto, email, phone: cleanPhone, document: cleanCpf },
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
      console.error("Erro Utmify:", utmErr);
    }

    return res.status(200).json(payevoData);

  } catch (error) {
    return res.status(500).json({ error: "Erro interno", message: error.message });
  }
}
