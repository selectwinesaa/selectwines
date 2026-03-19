// api/checkout.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { nome, sobrenome, email, cpf, telefone, totalPrice, metodo } = req.body;

  // 1. CONFIGURAÇÕES (Use Environment Variables na Vercel!)
  const SECRET_KEY = process.env.PAYEVO_SECRET_KEY; 
  const API_URL = "https://apiv2.payevo.com.br/functions/v1/transactions";

  // 2. PREPARAR O PAYLOAD (Valor em centavos)
  const amountCentavos = Math.round(parseFloat(totalPrice) * 100);

  const payload = {
    paymentMethod: metodo?.toUpperCase() || "PIX",
    customer: {
      name: `${nome} ${sobrenome}`,
      email: email,
      document: cpf?.replace(/\D/g, ""),
      phone: telefone?.replace(/\D/g, "")
    },
    pix: { expiresInDays: 1 },
    items: [{
      title: "Compra Online",
      unitPrice: amountCentavos,
      quantity: 1
    }],
    metadata: `Pedido_${Date.now()}`
  };

  // 3. AUTENTICAÇÃO BASIC (Node.js style)
  const auth = Buffer.from(`${SECRET_KEY}:`).toString('base64');

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    return res.status(500).json({ error: "Erro na conexão com PayEvo", details: error.message });
  }
}