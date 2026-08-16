/**
 * Cuidelar — Asaas Billing & Subscription Integration
 * ============================================================
 * Módulo de integração com o gateway Asaas (API v3) para gestão
 * de clientes, assinaturas recorrentes (Pix, Cartão, Boleto) e
 * controle automático de status de cobrança dos tenants.
 * ============================================================
 */

const ASAAS_KEY_B64 = 'JGFhY3RfaG1sZ18wMDBNemt3T0RBMk1XWTJPR00zTVdSbE1EVTJOV00zTXpKbE56Wm1OR1poWkdZNk9qRTJPR016T1RnekxUTXpNREV0TkdOalpDMDVZMlF6TFdSa05UTXpPVFV3WkRabFpqbzZKR0ZoWTJoZk1EUXhZVEZtWlRjdE0yRTFZeTAwWXpNeExXRXlOR1l0TUdRd05qWmtOelJrTUdFMw==';

const ASAAS_CONFIG = {
  // Ambiente Sandbox Asaas
  apiUrl: 'https://sandbox.asaas.com/api/v3',
  get apiKey() {
    return window.__ASAAS_KEY__ || localStorage.getItem('asaas_api_key') || atob(ASAAS_KEY_B64);
  }
};

/**
 * Passo A: Criar um Cliente no Asaas
 * @param {Object} clienteData { nome, email, cpfCnpj, telefone }
 */
export async function criarClienteAsaas({ nome, email, cpfCnpj, telefone = '' }, apiKeyOverride = null) {
  const rawToken = apiKeyOverride || ASAAS_CONFIG.apiKey;
  const token = (rawToken || '').trim();
  const payload = {
    name: nome,
    email: email,
    cpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : '',
    phone: telefone ? telefone.replace(/\D/g, '') : '',
    notificationDisabled: false,
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

    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Chave de API do Asaas não autorizada (401). Verifique se a chave gerada no Sandbox do Asaas está ativa.');
      }
      throw new Error(data.errors?.[0]?.description || `Erro ${res.status} ao criar cliente no Asaas`);
    }

    console.log('[Asaas] ✅ Cliente criado:', data.id);
    return data;
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
