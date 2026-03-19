export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { nome, sobrenome, email, cpf, telefone, totalPrice } = req.body;
    const SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

    if (!SECRET_KEY) {
      return res.status(500).json({ error: "ERRO: PAYEVO_SECRET_KEY não encontrada na Vercel." });
    }

    // Validação básica para evitar erro 500 por dados nulos
    if (!nome || !cpf || !totalPrice) {
      return res.status(400).json({ error: "Dados incompletos no formulário." });
    }

    const amountCentavos = Math.round(parseFloat(totalPrice) * 100);

    const payload = {
      paymentMethod: "PIX",
      customer: {
        name: `${nome} ${sobrenome}`.trim(),
        email: email,
        phone: telefone?.replace(/\D/g, ""),
        document: {
          number: cpf?.replace(/\D/g, ""),
          type: "CPF"
        }
      },
      pix: { expiresInDays: 1 },
      items: [{
        title: "Pedido Select Wines",
        amount: amountCentavos,
        quantity: 1
      }]
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

    // Se a PayEvo recusar a requisição, retornamos o erro dela para você ver no console do navegador
    if (!response.ok) {
      return res.status(response.status).json({ 
        message: "A PayEvo recusou a transação", 
        payEvoError: data 
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
