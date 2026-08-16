// api/asaas-proxy.js — Vercel Serverless Proxy para API v3 do Asaas (evita bloqueio de CORS no navegador)
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, access_token'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { action, nome, email, cpfCnpj, valor, descricao, apiKey, isProduction } = req.body || {};

    const baseUrl = isProduction
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    // Chave recebida do front-end ou variável de ambiente ou fallback base64
    const defaultB64 = 'JGFhY3RfaG1sZ18wMDBNemt3T0RBMk1XWTJPR00zTVdSbE1EVTJOV00zTXpKbE56Wm1OR1poWkdZNk9qRTJPR016T1RnekxUTXpNREV0TkdOalpDMDVZMlF6TFdSa05UTXpPVFV3WkRabFpqbzZKR0ZoWTJoZk1EUXhZVEZtWlRjdE0yRTFZeTAwWXpNeExXRXlOR1l0TUdRd05qWmtOelJrTUdFMw==';
    const fallbackKey = Buffer.from(defaultB64, 'base64').toString('utf-8');
    const rawKey = apiKey || process.env.ASAAS_API_KEY || fallbackKey;
    const token = (rawKey || '').trim();

    if (action === 'criar_cliente_e_assinatura') {
      // 1. Criar Cliente
      const custRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': token,
        },
        body: JSON.stringify({
          name: nome,
          email: email,
          cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : '',
          notificationDisabled: false,
        }),
      });

      const custText = await custRes.text();
      let custData = {};
      try { custData = JSON.parse(custText); } catch {}

      if (!custRes.ok) {
        const errMsg = custData.errors?.[0]?.description || `Erro ${custRes.status} ao criar cliente no Asaas.`;
        return res.status(custRes.status).json({ error: errMsg, details: custData });
      }

      // Data de primeiro vencimento: amanhã
      const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      // 2. Criar Assinatura Recorrente
      const subRes = await fetch(`${baseUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': token,
        },
        body: JSON.stringify({
          customer: custData.id,
          billingType: 'UNDEFINED',
          value: parseFloat(valor || 299.00),
          nextDueDate: amanha,
          cycle: 'MONTHLY',
          description: descricao || `Assinatura Mensal - Sistema Gestão Cuidadores (${nome})`,
        }),
      });

      const subText = await subRes.text();
      let subData = {};
      try { subData = JSON.parse(subText); } catch {}

      if (!subRes.ok) {
        const errMsg = subData.errors?.[0]?.description || `Erro ${subRes.status} ao criar assinatura no Asaas.`;
        return res.status(subRes.status).json({ error: errMsg, details: subData });
      }

      // 3. Buscar primeira fatura da assinatura para obter o link de pagamento
      let invoiceUrl = subData.invoiceUrl || subData.paymentLink || null;
      if (!invoiceUrl && subData.id) {
        try {
          const payRes = await fetch(`${baseUrl}/subscriptions/${subData.id}/payments?limit=1`, {
            headers: { 'access_token': token },
          });
          if (payRes.ok) {
            const payData = await payRes.json();
            if (payData.data && payData.data.length > 0) {
              invoiceUrl = payData.data[0].bankSlipUrl || payData.data[0].invoiceUrl || payData.data[0].paymentLink || null;
            }
          }
        } catch (payErr) {
          console.warn('[Asaas Proxy] Erro ao buscar cobrança da assinatura:', payErr);
        }
      }

      return res.status(200).json({
        success: true,
        customerId: custData.id,
        subscriptionId: subData.id,
        invoiceUrl: invoiceUrl,
        customer: custData,
        subscription: subData,
      });
    }

    return res.status(400).json({ error: 'Ação não reconhecida no proxy' });

  } catch (err) {
    console.error('[Asaas Proxy Error]:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no proxy Asaas' });
  }
}
