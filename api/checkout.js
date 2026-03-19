export default async function handler(req, res) {
  // 1. Validar método
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { nome, sobrenome, email, cpf, telefone, totalPrice } = req.body;
    const SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

    // 2. Validar Configuração
    if (!SECRET_KEY) {
      return res.status(500).json({ error: "Configuração ausente: PAYEVO_SECRET_KEY" });
    }

    // 3. Preparar dados (PayEvo exige centavos e CPF como objeto)
    const amountCentavos = Math.round(parseFloat(totalPrice) * 100);
    const cleanCPF = cpf?.replace(/\D/g, "");
    const cleanPhone = telefone?.replace(/\D/g, "");

    const payload = {
      paymentMethod: "PIX",
      customer: {
        name: `${nome} ${sobrenome}`.trim(),
        email: email.trim(),
        phone: cleanPhone,
        document: {
          number: cleanCPF,
          type: "CPF"
        }
      },
      pix: { 
        expiresInDays: 1 
      },
      items: [{
        title: "Pedido Select Wines",
        amount: amountCentavos, // Conforme documentação: 'amount' em centavos
        quantity: 1
      }],
      metadata: `Pedido_${Date.now()}`
    };

    // 4. Autenticação Basic (SECRET_KEY + ":")
    const auth = Buffer.from(`${SECRET_KEY}:`).toString('base64');

    // 5. Chamada para a API PayEvo
    const response = await fetch("https://apiv2.payevo.com.br/functions/v1/transactions", {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // 6. Retorno detalhado em caso de erro da API deles
    if (!response.ok) {
      console.error("PayEvo Reject:", data);
      return res.status(response.status).json({
        success: false,
        message: "A PayEvo recusou a transação",
        details: data
      });
    }

    // 7. Sucesso!
    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro Interno Checkout:", error);
    return res.status(500).json({ 
      error: "Erro crítico no servidor", 
      details: error.message 
    });
  }
}
