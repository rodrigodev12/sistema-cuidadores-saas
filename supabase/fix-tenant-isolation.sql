-- ============================================================
-- CuideLar / SaaS — Migration de Correção do Isolamento Multi-tenant
-- Execute este script no SQL Editor do Supabase para corrigir o isolamento
-- ============================================================

-- 1. Garantir que a agência padrão 'suaagencia' (Sua Agência Home Care) exista na tabela tenants
INSERT INTO public.tenants (slug, nome, url_logo, cor_primaria, cor_secundaria, emoji_logo, slogan)
VALUES ('suaagencia', 'Sua Agência Home Care', NULL, '#2563EB', '#3B82F6', '⭐', 'Cuidado de qualidade para sua família')
ON CONFLICT (slug) DO NOTHING;

-- 2. Atribuir o tenant_id da agência 'suaagencia' (ou 'cuidelar') a todos os registros órfãos (tenant_id IS NULL)
DO $$
DECLARE
  v_default_tenant_id UUID;
BEGIN
  -- Tenta obter id de 'suaagencia', se não encontrar tenta 'cuidelar'
  SELECT id INTO v_default_tenant_id FROM public.tenants WHERE slug IN ('suaagencia', 'cuidelar') ORDER BY criado_em ASC LIMIT 1;
  
  IF v_default_tenant_id IS NOT NULL THEN
    UPDATE public.usuarios          SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.cuidadores        SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.clientes_familia  SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.idosos            SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.escalas_servicos  SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.plantoes_diarios  SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;

    RAISE NOTICE 'Registros órfãos associados com sucesso ao tenant %', v_default_tenant_id;
  END IF;
END $$;

-- 3. Atualizar Políticas de Segurança RLS para isolamento estrito
-- Removendo permissões permissivas 'tenant_id IS NULL'

-- --- CUIDADORES ---
DROP POLICY IF EXISTS "cuidadores_tenant_isolamento" ON public.cuidadores;
CREATE POLICY "cuidadores_tenant_isolamento" ON public.cuidadores
  FOR ALL USING (
    tenant_id = public.meu_tenant_id()
    OR public.meu_tenant_id() IS NULL
  );

-- --- CLIENTES_FAMILIA ---
DROP POLICY IF EXISTS "clientes_tenant_isolamento" ON public.clientes_familia;
CREATE POLICY "clientes_tenant_isolamento" ON public.clientes_familia
  FOR ALL USING (
    tenant_id = public.meu_tenant_id()
    OR public.meu_tenant_id() IS NULL
  );

-- --- IDOSOS ---
DROP POLICY IF EXISTS "idosos_tenant_isolamento" ON public.idosos;
CREATE POLICY "idosos_tenant_isolamento" ON public.idosos
  FOR ALL USING (
    tenant_id = public.meu_tenant_id()
    OR public.meu_tenant_id() IS NULL
  );

-- --- ESCALAS_SERVICOS ---
DROP POLICY IF EXISTS "escalas_tenant_isolamento" ON public.escalas_servicos;
CREATE POLICY "escalas_tenant_isolamento" ON public.escalas_servicos
  FOR ALL USING (
    tenant_id = public.meu_tenant_id()
    OR public.meu_tenant_id() IS NULL
  );

-- --- PLANTOES_DIARIOS ---
DROP POLICY IF EXISTS "plantoes_tenant_isolamento" ON public.plantoes_diarios;
CREATE POLICY "plantoes_tenant_isolamento" ON public.plantoes_diarios
  FOR ALL USING (
    tenant_id = public.meu_tenant_id()
    OR public.meu_tenant_id() IS NULL
  );

-- ============================================================
-- 4. DESMEMBRAMENTO MULTI-TENANT: Remover constraints UNIQUE globais
-- Permite que um mesmo cuidador ou cliente trabalhe/esteja cadastrado
-- em agências diferentes sem conflito de duplicidade global no banco.
-- ============================================================

-- A. Cuidadores: Remover restrição global de CPF e criar índice único por Tenant
ALTER TABLE public.cuidadores DROP CONSTRAINT IF EXISTS cuidadores_cpf_key;
DROP INDEX IF EXISTS public.idx_cuidadores_tenant_cpf;
CREATE UNIQUE INDEX idx_cuidadores_tenant_cpf 
  ON public.cuidadores (tenant_id, cpf) 
  WHERE cpf IS NOT NULL AND tenant_id IS NOT NULL;

-- B. Clientes / Família: Remover restrição global de CPF e criar índice único por Tenant
ALTER TABLE public.clientes_familia DROP CONSTRAINT IF EXISTS clientes_familia_cpf_key;
DROP INDEX IF EXISTS public.idx_clientes_familia_tenant_cpf;
CREATE UNIQUE INDEX idx_clientes_familia_tenant_cpf 
  ON public.clientes_familia (tenant_id, cpf) 
  WHERE cpf IS NOT NULL AND tenant_id IS NOT NULL;

