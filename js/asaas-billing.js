/**
 * Cuidelar — Asaas Billing & Subscription Integration
 * ============================================================
 * Módulo de integração com o gateway Asaas (API v3) para gestão
 * de clientes, assinaturas recorrentes (Pix, Cartão, Boleto) e
 * controle automático de status de cobrança dos tenants.
 * ============================================================
 */

const ASAAS_CONFIG = {
  // Ambiente Sandbox por padrão (trocar para https://api.asaas.com em produção)
  apiUrl: 'https://sandbox.asaas.com/api/v3',
  apiKey: '$aact_Ytu4YTEyM2E4WjIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6', // Placeholder / Config de ambiente
};

/**
 * Passo A: Criar um Cliente no Asaas
 * @param {Object} clienteData { nome, email, cpfCnpj, telefone }
 */
export async function criarClienteAsaas({ nome, email, cpfCnpj, telefone = '' }, apiKeyOverride = null) {
  const token = apiKeyOverride || ASAAS_CONFIG.apiKey;
  const payload = {
    name: nome,
    email: email,
    cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : '',
    phone: telefone ? telefone.replace(/\D/g, '') : '',
    notificationDisabled: false, // O Asaas avisa o cliente por e-mail e SMS
  };

  console.log('[Asaas] Criando cliente:', payload.name, payload.email);

  try {
    const res = await fetch(`${ASAAS_CONFIG.apiUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': token,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.[0]?.description || 'Erro ao criar cliente no Asaas');
    }

    console.log('[Asaas] ✅ Cliente criado:', data.id);
    return data; // { id: "cus_...", name: "...", email: "..." }
  } catch (err) {
    console.error('[Asaas] Erro em criarClienteAsaas:', err);
    throw err;
  }
}

/**
 * Passo B: Criar uma Assinatura Recorrente no Asaas (Pix, Cartão, Boleto)
 * @param {Object} subData { customerId, valor, descricao, cycle }
 */
export async function criarAssinaturaAsaas({ customerId, valor = 299.00, descricao = 'Assinatura Mensal - Sistema Cuidadores SaaS', cycle = 'MONTHLY' }, apiKeyOverride = null) {
  const token = apiKeyOverride || ASAAS_CONFIG.apiKey;
  
  // Data da primeira cobrança em 3 dias a partir de hoje
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);
  const nextDueDate = dueDate.toISOString().split('T')[0];

  const payload = {
    customer: customerId,
    billingType: 'UNDEFINED', // Permite Pix, Cartão ou Boleto no checkout
    value: parseFloat(valor),
    nextDueDate: nextDueDate,
    cycle: cycle, // MONTHLY, YEARLY
    description: descricao,
  };

  console.log('[Asaas] Criando assinatura para customer:', customerId, 'Valor:', valor);

  try {
    const res = await fetch(`${ASAAS_CONFIG.apiUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': token,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.[0]?.description || 'Erro ao criar assinatura no Asaas');
    }

    console.log('[Asaas] ✅ Assinatura gerada:', data.id, 'Link:', data.invoiceUrl);
    return {
      subscriptionId: data.id,
      invoiceUrl: data.invoiceUrl || `https://sandbox.asaas.com/i/${data.id}`,
      status: data.status,
      value: data.value,
      nextDueDate: data.nextDueDate,
    };
  } catch (err) {
    console.error('[Asaas] Erro em criarAssinaturaAsaas:', err);
    throw err;
  }
}

/**
 * Processador de Eventos Webhook do Asaas (Simulação e Estrutura Backend)
 * @param {Object} eventData Evento enviado pelo Webhook do Asaas
 */
export function processarEventoWebhookAsaas(eventData) {
  const event = eventData.event;
  const payment = eventData.payment;
  const customerId = payment?.customer;

  console.log('[Asaas Webhook] Evento recebido:', event, 'Cliente:', customerId);

  switch (event) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
      console.log('[Asaas Webhook] ✅ Pagamento confirmado. Ativando tenant...');
      return { status_assinatura: 'ativa', customerId, action: 'ACTIVATE' };

    case 'PAYMENT_OVERDUE':
      console.warn('[Asaas Webhook] ⚠️ Pagamento em atraso. Bloqueando tenant...');
      return { status_assinatura: 'bloqueada', customerId, action: 'BLOCK', invoiceUrl: payment?.invoiceUrl };

    case 'SUBSCRIPTION_DELETED':
    case 'SUBSCRIPTION_CANCELLED':
      console.warn('[Asaas Webhook] 🛑 Assinatura cancelada.');
      return { status_assinatura: 'cancelada', customerId, action: 'CANCEL' };

    default:
      console.log('[Asaas Webhook] Evento não mapeado:', event);
      return { action: 'IGNORE' };
  }
}
