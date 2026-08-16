-- ============================================================
-- CuideLar — Migration Fase 3: Asaas Billing & Subscription Control
-- Execute no SQL Editor do Supabase (uma vez)
-- ============================================================

-- Adicionar colunas de cobrança Asaas e controle de assinatura na tabela tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status_assinatura TEXT CHECK (status_assinatura IN ('trial', 'ativa', 'bloqueada', 'cancelada')) DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS link_pagamento_asaas TEXT,
  ADD COLUMN IF NOT EXISTS vencimento_assinatura DATE,
  ADD COLUMN IF NOT EXISTS valor_plano NUMERIC(10,2) DEFAULT 299.00,
  ADD COLUMN IF NOT EXISTS plano_nome TEXT DEFAULT 'Mensal Pro';

-- Índices de performance para busca por status e cliente no gateway
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status_assinatura);
CREATE INDEX IF NOT EXISTS idx_tenants_asaas_customer ON public.tenants(asaas_customer_id);

-- Atualizar o tenant padrão (cuidelar) e agências existentes para status 'ativa' se estiver nulo
UPDATE public.tenants
  SET status_assinatura = 'ativa',
      valor_plano = 299.00,
      plano_nome = 'Mensal Pro'
  WHERE status_assinatura IS NULL;

-- Exibir status atual dos tenants para confirmação
SELECT id, slug, nome, status_assinatura, asaas_customer_id, asaas_subscription_id, link_pagamento_asaas, valor_plano
FROM public.tenants;
