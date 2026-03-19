export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { nome, sobrenome, email, cpf, telefone, totalPrice, metodo } = req.body;
    const SECRET_KEY = process.env.PAYEVO_SECRET_KEY;

    if (!SECRET_KEY) {
      return res.status(500).json({ error: "Chave de API não configurada na Vercel" });
    }

    // A PayEvo exige o valor em centavos (Ex: 10.00 vira 1000)
    const amountCentavos = Math.round(parseFloat(totalPrice) * 100);

    const payload = {
      paymentMethod: metodo?.toUpperCase() || "PIX",
      customer: {
        name: `${nome} ${sobrenome}`,
        email: email,
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
        amount: amountCentavos, // Documentação pede 'amount'
        quantity: 1
      }],
      metadata: `Pedido_${Date.now()}`
    };

    // Autenticação Basic correta conforme o exemplo da doc
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
      console.error("Erro da PayEvo:", data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: "Erro ao processar requisição", details: error.message });
  }
}
