export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { nome, sobrenome, email, cpf, telefone, totalPrice } = req.body;
    const SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

    if (!SECRET_KEY) {
      return res.status(500).json({ error: "Configuração ausente: PAYEVO_SECRET_KEY" });
    }

    // Garante que o valor seja um número e converte para centavos (inteiro)
    const amountCentavos = Math.round(Number(totalPrice) * 100);

    const payload = {
      paymentMethod: "PIX",
      // ADICIONADO: Algumas APIs exigem o amount na raiz do body
      amount: amountCentavos, 
      customer: {
        name: `${nome} ${sobrenome}`.trim(),
        email: email.trim(),
        phone: telefone?.replace(/\D/g, ""),
        document: {
          number: cpf?.replace(/\D/g, ""),
          type: "CPF"
        }
      },
      pix: { 
        expiresInDays: 1 
      },
      items: [{
        title: "Compra Select Wines",
        amount: amountCentavos,
        quantity: 1
      }],
      metadata: {
        order_id: `Pedido_${Date.now()}`
      }
    };

    const auth = Buffer.from(`${SECRET_KEY}:`).toString('base64');

    const response = await fetch("https://apiv2.payevo.com.br/functions/v1/transactions", {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: "A PayEvo recusou a transação",
        details: data
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ 
      error: "Erro crítico no servidor", 
      details: error.message 
    });
  }
}
