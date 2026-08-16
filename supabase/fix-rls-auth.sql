-- ============================================================
-- CuideLar — CORREÇÃO RLS E AUTENTICAÇÃO v2 (Execute no SQL Editor)
-- ============================================================

-- Habilitar extensão pgcrypto no schema extensions e public
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 1. CORRIGIR RECURSÃO INFINITA NA TABELA public.usuarios
CREATE OR REPLACE FUNCTION public.sou_admin_do_tenant(t_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_id = auth.uid()
      AND tipo = 'administrador'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, auth;

GRANT EXECUTE ON FUNCTION public.sou_admin_do_tenant(UUID) TO authenticated, anon;

-- Remover políticas antigas com recursão
DROP POLICY IF EXISTS "admin_mesmo_tenant" ON public.usuarios;
DROP POLICY IF EXISTS "admin_all"          ON public.usuarios;
DROP POLICY IF EXISTS "proprio_usuario"    ON public.usuarios;
DROP POLICY IF EXISTS "leitura_usuarios"   ON public.usuarios;
DROP POLICY IF EXISTS "escrita_usuarios"   ON public.usuarios;

-- Novas políticas sem recursão
CREATE POLICY "leitura_usuarios" ON public.usuarios
  FOR SELECT USING (true);

CREATE POLICY "escrita_usuarios" ON public.usuarios
  FOR ALL USING (
    auth_id = auth.uid()
    OR public.sou_admin_do_tenant(tenant_id)
  );

-- 2. CORRIGIR E RE-CRIAR A FUNÇÃO RPC DE CADASTRO COM SENHA (usando extensions.crypt / extensions.gen_salt)
CREATE OR REPLACE FUNCTION public.criar_usuario_com_senha(
  p_nome TEXT,
  p_email TEXT,
  p_tipo TEXT,
  p_senha TEXT
) RETURNS UUID AS $$
DECLARE
  v_auth_id UUID;
  v_user_id UUID;
  v_instance_id UUID;
BEGIN
  -- 1. Se o usuário já tem auth.users com esta senha, atualiza o perfil
  SELECT id INTO v_auth_id FROM auth.users WHERE lower(email) = lower(p_email) LIMIT 1;

  IF v_auth_id IS NULL THEN
    -- Obter o instance_id atual do projeto
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
    v_auth_id := gen_random_uuid();

    -- Insere na tabela auth.users do Supabase com senha criptografada via extensions.crypt/gen_salt
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_instance_id,
      v_auth_id,
      'authenticated',
      'authenticated',
      p_email,
      extensions.crypt(p_senha, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now()
    );

    -- Insere na auth.identities
    INSERT INTO auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_auth_id,
      v_auth_id::text,
      v_auth_id,
      json_build_object('sub', v_auth_id, 'email', p_email)::jsonb,
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    -- Atualiza a senha existente em auth.users
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf')),
        updated_at = now()
    WHERE id = v_auth_id;
  END IF;

  -- 2. Upsert na tabela public.usuarios
  SELECT id INTO v_user_id FROM public.usuarios WHERE lower(email) = lower(p_email) LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.usuarios
    SET auth_id = v_auth_id,
        nome = p_nome,
        tipo = p_tipo,
        ativo = true,
        atualizado_em = now()
    WHERE id = v_user_id;
  ELSE
    INSERT INTO public.usuarios (auth_id, nome, email, tipo, ativo)
    VALUES (v_auth_id, p_nome, p_email, p_tipo, true)
    RETURNING id INTO v_user_id;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, auth;

GRANT EXECUTE ON FUNCTION public.criar_usuario_com_senha(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;

-- 3. EXECUTAR A CORREÇÃO DIRETA PARA A CONTA DA INFINIX HOME
SELECT public.criar_usuario_com_senha('Admin Infinix Home', 'contato@infinixhome.com.br', 'administrador', '123456');

-- Vincular ao tenant infinixhome
UPDATE public.usuarios
SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'infinixhome' LIMIT 1)
WHERE lower(email) = 'contato@infinixhome.com.br';

-- 4. VERIFICAÇÃO
SELECT u.id, u.nome, u.email, u.tipo, u.auth_id, t.slug AS tenant_slug
FROM public.usuarios u
LEFT JOIN public.tenants t ON t.id = u.tenant_id
WHERE lower(u.email) = 'contato@infinixhome.com.br';
