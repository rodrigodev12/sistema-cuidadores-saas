-- ============================================================
-- CuideLar — Migration Fase 2: White Label Multi-tenant
-- Execute no SQL Editor do Supabase (uma vez)
-- ============================================================

-- ============================================================
-- FASE A: SUPABASE STORAGE — Bucket de Logos
-- ============================================================

-- Criar bucket público para logos dos tenants
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'tenant-logos',
  'tenant-logos',
  true,
  ARRAY['image/png','image/jpeg','image/svg+xml','image/webp','image/gif'],
  2097152  -- 2MB
) ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
DROP POLICY IF EXISTS "tenant_logo_upload" ON storage.objects;
DROP POLICY IF EXISTS "tenant_logo_read"   ON storage.objects;
DROP POLICY IF EXISTS "tenant_logo_delete" ON storage.objects;

CREATE POLICY "tenant_logo_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'tenant-logos');

CREATE POLICY "tenant_logo_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-logos');

CREATE POLICY "tenant_logo_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'tenant-logos');

CREATE POLICY "tenant_logo_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-logos');

-- ============================================================
-- FASE B: COLUNAS tenant_id NAS TABELAS PRINCIPAIS
-- ============================================================

ALTER TABLE public.cuidadores
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.clientes_familia
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.idosos
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.escalas_servicos
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.plantoes_diarios
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cuidadores_tenant      ON public.cuidadores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant        ON public.clientes_familia(tenant_id);
CREATE INDEX IF NOT EXISTS idx_idosos_tenant          ON public.idosos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_escalas_tenant         ON public.escalas_servicos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plantoes_tenant        ON public.plantoes_diarios(tenant_id);

-- ============================================================
-- FASE B: FUNÇÃO AUXILIAR — meu_tenant_id()
-- Retorna o tenant_id do usuário autenticado atualmente
-- ============================================================

CREATE OR REPLACE FUNCTION public.meu_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM public.usuarios
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.meu_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_tenant_id() TO anon;

-- ============================================================
-- FASE B: POLÍTICAS RLS MULTI-TENANT
-- ============================================================

-- --- CUIDADORES ---
DROP POLICY IF EXISTS "cuidadores_tenant_isolamento" ON public.cuidadores;
CREATE POLICY "cuidadores_tenant_isolamento" ON public.cuidadores
  FOR ALL USING (
    tenant_id IS NULL  -- dados sem tenant ainda (compatibilidade)
    OR tenant_id = public.meu_tenant_id()
  );

-- --- CLIENTES_FAMILIA ---
DROP POLICY IF EXISTS "clientes_tenant_isolamento" ON public.clientes_familia;
CREATE POLICY "clientes_tenant_isolamento" ON public.clientes_familia
  FOR ALL USING (
    tenant_id IS NULL
    OR tenant_id = public.meu_tenant_id()
  );

-- --- IDOSOS ---
DROP POLICY IF EXISTS "idosos_tenant_isolamento" ON public.idosos;
CREATE POLICY "idosos_tenant_isolamento" ON public.idosos
  FOR ALL USING (
    tenant_id IS NULL
    OR tenant_id = public.meu_tenant_id()
  );

-- --- ESCALAS_SERVICOS ---
DROP POLICY IF EXISTS "escalas_tenant_isolamento" ON public.escalas_servicos;
CREATE POLICY "escalas_tenant_isolamento" ON public.escalas_servicos
  FOR ALL USING (
    tenant_id IS NULL
    OR tenant_id = public.meu_tenant_id()
  );

-- --- PLANTOES_DIARIOS ---
DROP POLICY IF EXISTS "Leitura total em plantoes_diarios" ON public.plantoes_diarios;
DROP POLICY IF EXISTS "Escrita total em plantoes_diarios"  ON public.plantoes_diarios;
DROP POLICY IF EXISTS "plantoes_tenant_isolamento"         ON public.plantoes_diarios;
CREATE POLICY "plantoes_tenant_isolamento" ON public.plantoes_diarios
  FOR ALL USING (
    tenant_id IS NULL
    OR tenant_id = public.meu_tenant_id()
  );

-- --- USUARIOS: ampliar política existente para suportar tenant ---
-- (o admin já pode ver todos do seu tenant; cuidador/cliente vê só ele mesmo)
DROP POLICY IF EXISTS "admin_all"        ON public.usuarios;
DROP POLICY IF EXISTS "proprio_usuario"  ON public.usuarios;

-- Admin: ver/editar todos do mesmo tenant
CREATE POLICY "admin_mesmo_tenant" ON public.usuarios
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios me
      WHERE me.auth_id = auth.uid()
        AND me.tipo = 'administrador'
        AND me.tenant_id = usuarios.tenant_id
    )
  );

-- Usuário: ver/editar a si mesmo
CREATE POLICY "proprio_usuario" ON public.usuarios
  FOR ALL USING (auth_id = auth.uid());

-- ============================================================
-- FASE B: MIGRATION — Atribuir tenant padrão (cuidelar)
-- para todos os registros que ainda não têm tenant_id
-- ============================================================

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'cuidelar' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'Tenant cuidelar não encontrado. Pulando migration de dados.';
    RETURN;
  END IF;

  UPDATE public.usuarios
    SET tenant_id = v_tenant_id
    WHERE tenant_id IS NULL;

  UPDATE public.cuidadores
    SET tenant_id = v_tenant_id
    WHERE tenant_id IS NULL;

  UPDATE public.clientes_familia
    SET tenant_id = v_tenant_id
    WHERE tenant_id IS NULL;

  UPDATE public.idosos
    SET tenant_id = v_tenant_id
    WHERE tenant_id IS NULL;

  UPDATE public.escalas_servicos
    SET tenant_id = v_tenant_id
    WHERE tenant_id IS NULL;

  UPDATE public.plantoes_diarios
    SET tenant_id = v_tenant_id
    WHERE tenant_id IS NULL;

  RAISE NOTICE 'Migration concluída: tenant_id = % atribuído a todos os registros sem tenant.', v_tenant_id;
END;
$$;

-- ============================================================
-- GRANTS de acesso (anon e authenticated)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.tenants TO anon;
GRANT ALL    ON public.tenants TO authenticated;
GRANT ALL    ON public.usuarios TO authenticated;
GRANT ALL    ON public.cuidadores TO authenticated;
GRANT ALL    ON public.clientes_familia TO authenticated;
GRANT ALL    ON public.idosos TO authenticated;
GRANT ALL    ON public.escalas_servicos TO authenticated;
GRANT ALL    ON public.plantoes_diarios TO authenticated;
GRANT ALL    ON public.diario_cuidados TO authenticated;
GRANT ALL    ON public.atividades_escala TO authenticated;
GRANT ALL    ON public.avaliacoes TO authenticated;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT
  t.tablename,
  COUNT(p.policyname) AS num_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN ('tenants','usuarios','cuidadores','clientes_familia','idosos',
                       'escalas_servicos','plantoes_diarios')
GROUP BY t.tablename
ORDER BY t.tablename;
