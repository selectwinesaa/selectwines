export default async function handler(req, res) {
  // Garantir que apenas requisições POST sejam aceitas
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1. Extrair dados do corpo da requisição
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

    // 2. Validação de Segurança: Evita o erro "Cannot read properties of undefined (reading 'replace')"
    if (!name || !email || !cpf || !amount || !phone) {
      return res.status(400).json({
        error: "Dados incompletos",
        message: "Os campos name, email, phone, cpf e amount são obrigatórios.",
      });
    }

    // 3. Carregar Chaves da Vercel (conforme seus nomes no print)
    const secretKey = process.env.PAYEVO_SECRET_KEY;
    const utmifyToken = process.env.UTMIFY_API_TOKEN;

    if (!secretKey || !utmifyToken) {
      console.error("ERRO: Variáveis de ambiente não configuradas na Vercel.");
      return res.status(500).json({ error: "Erro de configuração no servidor." });
    }

    // 4. Preparar dados (Limpeza de caracteres e formatação)
    const basicAuth = Buffer.from(secretKey).toString("base64");
    const cleanCpf = String(cpf).replace(/\D/g, ""); // Remove pontos e traços
    const cleanPhone = String(phone).replace(/\D/g, ""); // Remove parênteses e espaços
    const valueInCents = parseInt(amount); // Deve ser um número inteiro (centavos)

    // 5. Chamada para PayEvo (Seguindo sua documentação técnica)
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
            name: name,
            email: email,
            phone: cleanPhone,
            document: {
              number: cleanCpf,
              type: "CPF",
            },
          },
          paymentMethod: "PIX",
          pix: {
            expiresInDays: 1, // Campo obrigatório
          },
          items: [
            {
              title: product_name || "Produto", // Doc pede 'title'
              unitPrice: valueInCents,          // Doc pede 'unitPrice'
              quantity: 1,
              externalRef: String(product_id || "PROD001"), // Campo obrigatório
            },
          ],
          amount: valueInCents,
          postbackUrl: "https://selectwines.online/api/webhook-payevo",
          description: product_name || "Pedido Select Wines",
        }),
      }
    );

    const payevoData = await payevoResponse.json();

    if (!payevoResponse.ok) {
      console.error("PayEvo Recusou:", payevoData);
      return res.status(payevoResponse.status).json({
        error: "PayEvo recusou a transação",
        details: payevoData,
      });
    }

    // 6. Enviar para Utmify (Status Inicial: waiting_payment)
    try {
      // Formato de data exigido pela Utmify: YYYY-MM-DD HH:MM:SS
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
          approvedDate: null,
          refundedAt: null,
          customer: { 
            name, 
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
            totalPriceInCents: valueInCents,
            gatewayFeeInCents: 0,
            userCommissionInCents: valueInCents,
          },
        }),
      });
    } catch (utmErr) {
      // Erro na Utmify não deve travar o checkout principal
      console.error("Erro Utmify (Non-blocking):", utmErr);
    }

    // Retornar dados da transação para o frontend (ex: QR Code do PIX)
    return res.status(200).json(payevoData);

  } catch (error) {
    console.error("Checkout Global Error:", error.message);
    return res.status(500).json({
      error: "Erro interno no checkout",
      message: error.message,
    });
  }
}
