export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Pegar os dados EXATAMENTE como o seu formulário envia
    const {
      nome,
      sobrenome,
      email,
      telefone,
      cpf,
      totalPrice, // No seu log está totalPrice
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

    // 2. Validação usando os nomes em português
    if (!nome || !email || !cpf || !totalPrice || !telefone) {
      return res.status(400).json({
        error: "Dados incompletos",
        message: "Os campos nome, email, telefone, cpf e totalPrice são obrigatórios.",
      });
    }

    const secretKey = process.env.PAYEVO_SECRET_KEY;
    const utmifyToken = process.env.UTMIFY_API_TOKEN;

    if (!secretKey || !utmifyToken) {
      return res.status(500).json({ error: "Erro de configuração (Vercel)" });
    }

    // 3. Preparação dos dados
    const basicAuth = Buffer.from(secretKey).toString("base64");
    
    // Unindo nome e sobrenome para a PayEvo
    const nomeCompleto = `${nome} ${sobrenome || ""}`.trim();
    const cleanCpf = String(cpf).replace(/\D/g, "");
    const cleanPhone = String(telefone).replace(/\D/g, "");
    
    // Convertendo totalPrice para centavos (Ex: 118.54 -> 11854)
    // Se o seu valor já vem multiplicado (ex: 11854), use apenas parseInt
    const valueInCents = Math.round(parseFloat(totalPrice)); 

    // 4. Chamada PayEvo
    const payevoResponse = await fetch(
      "https://apiv2.payevo.com.br/functions/v1/transactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + basicAuth,
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
          items: [
            {
              title: product_name || "Pedido Select Wines",
              unitPrice: valueInCents,
              quantity: 1,
              externalRef: String(product_id || "PROD_01"),
            },
          ],
          amount: valueInCents,
          postbackUrl: "https://selectwines.online/api/webhook-payevo",
          description: product_name || "Compra Select Wines",
        }),
      }
    );

    const payevoData = await payevoResponse.json();

    if (!payevoResponse.ok) {
      return res.status(payevoResponse.status).json({
        error: "PayEvo recusou",
        details: payevoData,
      });
    }

    // 5. Enviar para Utmify
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
          customer: { 
            name: nomeCompleto, 
            email, 
            phone: cleanPhone, 
            document: cleanCpf 
          },
          products: [
            {
              id: String(product_id || "1"),
              name: product_name || "Produto",
              quantity: 1,
              priceInCents: valueInCents,
            },
          ],
          trackingParameters: { src, sck, utm_source, utm_campaign, utm_medium, utm_content, utm_term },
          commission: {
            totalPriceInCents: valueInCents,
            gatewayFeeInCents: 0,
            userCommissionInCents: valueInCents,
          },
        }),
      });
    } catch (utmErr) {
      console.error("Utmify Error:", utmErr);
    }

    return res.status(200).json(payevoData);

  } catch (error) {
    return res.status(500).json({
      error: "Erro interno",
      message: error.message,
    });
  }
}
