/**
 * Cuidelar SaaS — Onboarding / Cadastro de Agências
 * ============================================================
 * Lógica de cadastro automatizado de novas agências (Tenants):
 *   1. Validação de slug disponível
 *   2. Registro de cliente e assinatura no Asaas API
 *   3. Gravação da agência no Supabase (status 'trial')
 *   4. Criação da conta do Administrador vinculada ao tenant_id
 *   5. Redirecionamento direto para o pagamento no Asaas
 * ============================================================
 */

import { criarClienteAsaas, criarAssinaturaAsaas } from './asaas-billing.js';

const SUPABASE_URL      = 'https://qfgmpxevmamfxjxcbfrh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZ21weGV2bWFtZnhqeGNiZnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTkxMDMsImV4cCI6MjEwMjM3NTEwM30.GVY80mUqMKJjf-9zozITq2FOWhUO9owGJxepuxNbJ3c';

export async function cadastrarAgencia(formData) {
  const { nome, slug, email, senha, cpfCnpj, corPrimaria, corSecundaria, emojiLogo, slogan } = formData;

  console.log('[Signup] Iniciando cadastro da agência:', nome, '| Slug:', slug);

  // 1. Verificar se o slug já existe no Supabase
  const checkUrl = `${SUPABASE_URL}/rest/v1/tenants?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`;
  const checkRes = await fetch(checkUrl, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  const checkData = await checkRes.json();
  if (checkData && checkData.length > 0) {
    throw new Error(`O identificador "${slug}" já está em uso por outra agência. Escolha outro slug.`);
  }

  let isRealInvoice = false;
  let asaasCustomer = null;
  let asaasSub = null;

  try {
    const asaasRes = await criarClienteEAssinaturaAsaas({
      nome: nome,
      email: email,
      cpfCnpj: cpfCnpj,
      valor: 299.00,
      descricao: `Assinatura Mensal - Sistema Gestão Cuidadores (${nome})`,
    });

    if (asaasRes && asaasRes.success) {
      asaasCustomer = { id: asaasRes.customerId };
      asaasSub = { subscriptionId: asaasRes.subscriptionId, invoiceUrl: asaasRes.invoiceUrl };
      if (asaasRes.invoiceUrl) {
        isRealInvoice = true;
      }
    }
  } catch (asaasErr) {
    console.warn('[Signup] Erro na integração Asaas (modo de demonstração ativado):', asaasErr);
    const mockId = 'cus_demo_' + Math.random().toString(36).substr(2, 6);
    const mockSubId = 'sub_demo_' + Math.random().toString(36).substr(2, 6);
    asaasCustomer = { id: mockId };
    asaasSub = {
      subscriptionId: mockSubId,
      invoiceUrl: null,
    };
  }

  // 3. Criar registro do Tenant na tabela public.tenants no Supabase
  const tenantPayload = {
    nome: nome,
    slug: slug.toLowerCase().trim(),
    cor_primaria: corPrimaria || '#5C3C67',
    cor_secundaria: corSecundaria || '#E07A8A',
    emoji_logo: emojiLogo || '🏠',
    slogan: slogan || 'Cuidado humanizado, gestão inteligente',
    status_assinatura: 'trial',
    asaas_customer_id: asaasCustomer?.id || null,
    asaas_subscription_id: asaasSub?.subscriptionId || null,
    link_pagamento_asaas: asaasSub?.invoiceUrl || null,
    valor_plano: 299.00,
    plano_nome: 'Mensal Pro',
    ativo: true,
  };

  const createTenantRes = await fetch(`${SUPABASE_URL}/rest/v1/tenants`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(tenantPayload),
  });

  const tenantData = await createTenantRes.json();
  if (!createTenantRes.ok || !tenantData || tenantData.length === 0) {
    throw new Error(tenantData.message || tenantData.error || 'Erro ao registrar agência no banco de dados.');
  }

  const newTenant = tenantData[0];
  console.log('[Signup] ✅ Agência registrada no Supabase ID:', newTenant.id);

  // 4. Criar o Usuário Administrador no Supabase com Senha Criptografada (auth.users + public.usuarios)
  try {
    const adminEmail = email.toLowerCase().trim();
    const adminNome  = `Admin ${nome}`;

    // Chama o RPC criar_usuario_com_senha que grava a senha criptografada no GoTrue Auth
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_usuario_com_senha`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_nome:  adminNome,
        p_email: adminEmail,
        p_tipo:  'administrador',
        p_senha: senha,
      }),
    });

    if (rpcRes.ok) {
      console.log('[Signup] ✅ RPC criar_usuario_com_senha executado com sucesso.');
    } else {
      console.warn('[Signup] Status do RPC ao criar admin:', rpcRes.status, await rpcRes.text());
    }

    // Vincula o usuario ao tenant_id correto
    await fetch(`${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(adminEmail)}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenant_id: newTenant.id,
        tipo: 'administrador',
        ativo: true,
      }),
    });

  } catch (userErr) {
    console.warn('[Signup] Aviso ao vincular admin:', userErr);
  }

  // 5. Salva tenant no localStorage
  localStorage.setItem('tenant_id', newTenant.id);
  localStorage.setItem('wl_tenant_slug', newTenant.slug);

  return {
    success: true,
    tenant: newTenant,
    isRealInvoice: isRealInvoice,
    invoiceUrl: asaasSub?.invoiceUrl || null,
  };
}
