-- ============================================================
-- CuideLar — Schema PostgreSQL (Supabase)
-- ============================================================
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 0. TENANTS (White Label / Marca Branca)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT UNIQUE NOT NULL,    -- ex: "agenciaxyz" (subdomínio ou ?tenant=slug)
  nome           TEXT NOT NULL,           -- ex: "Agência XYZ"
  url_logo       TEXT,                    -- URL pública do logotipo (PNG/SVG)
  cor_primaria   TEXT DEFAULT '#5C3C67', -- hex: cor de botões, sidebar
  cor_secundaria TEXT DEFAULT '#E07A8A', -- hex: cor de destaque/acento
  emoji_logo     TEXT DEFAULT '🏠',     -- fallback emoji se url_logo falhar
  slogan         TEXT DEFAULT 'Cuidado humanizado, gestão inteligente', -- tela de login
  ativo          BOOLEAN DEFAULT TRUE,
  criado_em      TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para tenants: leitura pública (necessário antes do login), escrita apenas para admins
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants_read_public" ON public.tenants
  FOR SELECT USING (true);
CREATE POLICY "tenants_write_admin" ON public.tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.auth_id = auth.uid() AND u.tipo = 'administrador'
    )
  );

-- Trigger para atualizar atualizado_em na tabela tenants
CREATE TRIGGER trg_tenants_atualizado
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- Inserir tenant padrão (Cuidelar)
INSERT INTO public.tenants (slug, nome, url_logo, cor_primaria, cor_secundaria, emoji_logo, slogan)
VALUES (
  'cuidelar',
  'Cuidelar',
  'assets/logo-cuidelar.png',
  '#5C3C67',
  '#E07A8A',
  '🏠',
  'Cuidado humanizado, gestão inteligente'
) ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 1. USUÁRIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  tipo        TEXT CHECK (tipo IN ('administrador', 'cuidador', 'cliente')) NOT NULL,
  avatar_url  TEXT,
  ativo       BOOLEAN DEFAULT TRUE,
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE SET NULL, -- White Label
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- MIGRATION: adicionar tenant_id em bancos já existentes
-- ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- ============================================================
-- 2. CLIENTES / FAMÍLIA
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes_familia (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario  UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  telefone    TEXT,
  celular     TEXT,
  cpf         TEXT UNIQUE,
  cep         TEXT,
  logradouro  TEXT,
  numero      TEXT,
  complemento TEXT,
  bairro      TEXT,
  cidade      TEXT,
  estado      CHAR(2),
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. IDOSOS
-- ============================================================
CREATE TABLE IF NOT EXISTS idosos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente        UUID REFERENCES clientes_familia(id) ON DELETE CASCADE,
  nome              TEXT NOT NULL,
  data_nascimento   DATE,
  genero            TEXT CHECK (genero IN ('masculino', 'feminino', 'outro')),
  tipo_sanguineo    TEXT CHECK (tipo_sanguineo IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  restricoes_medicas TEXT,
  alergias          TEXT,
  medicamentos      TEXT,  -- lista de medicamentos contínuos
  foto_url          TEXT,
  endereco          TEXT,
  observacoes       TEXT,
  plano_saude       TEXT,
  numero_plano      TEXT,
  medico_responsavel TEXT,
  contato_emergencia TEXT,
  telefone_emergencia TEXT,
  perfil            TEXT CHECK (perfil IN ('idoso', 'crianca_autista')) DEFAULT 'idoso' NOT NULL,
  ativo             BOOLEAN DEFAULT TRUE,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. CUIDADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS cuidadores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario      UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  cpf             TEXT UNIQUE,
  rg              TEXT,
  data_nascimento DATE,
  telefone        TEXT,
  formacao        TEXT,
  certificados    TEXT,
  especialidades  TEXT[],  -- array de especialidades
  publico_atendido TEXT[] DEFAULT ARRAY['idoso']::TEXT[] NOT NULL,  -- array de públicos atendidos
  disponibilidade JSONB DEFAULT '{}',  -- {"seg": ["08:00","18:00"], "ter": [...], ...}
  valor_hora          NUMERIC(10,2) DEFAULT 0,
  porcentagem_agencia NUMERIC(5,2) DEFAULT 20.00,
  status              TEXT CHECK (status IN ('ativo', 'inativo', 'ferias')) DEFAULT 'ativo',
  avaliacao_media NUMERIC(3,2) DEFAULT 0,
  total_avaliacoes INT DEFAULT 0,
  bio             TEXT,
  foto_url        TEXT,
  cep             TEXT,
  logradouro      TEXT,
  numero          TEXT,
  cidade          TEXT,
  estado          CHAR(2),
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ESCALAS DE SERVIÇO
-- ============================================================
CREATE TABLE IF NOT EXISTS escalas_servicos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_idoso        UUID REFERENCES idosos(id),
  id_cuidador     UUID REFERENCES cuidadores(id),
  data_inicio     TIMESTAMPTZ NOT NULL,
  data_termino    TIMESTAMPTZ NOT NULL,
  valor_hora      NUMERIC(10,2),
  valor_total     NUMERIC(10,2),
  status          TEXT CHECK (status IN ('agendado','em_andamento','concluido','cancelado')) DEFAULT 'agendado',
  -- Check-in / Check-out
  checkin_hora    TIMESTAMPTZ,
  checkin_lat     NUMERIC(10,7),
  checkin_lng     NUMERIC(10,7),
  checkout_hora   TIMESTAMPTZ,
  checkout_lat    NUMERIC(10,7),
  checkout_lng    NUMERIC(10,7),
  -- Financeiro
  pago            BOOLEAN DEFAULT FALSE,
  data_pagamento  DATE,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ATIVIDADES DO CHECKLIST (por escala)
-- ============================================================
CREATE TABLE IF NOT EXISTS atividades_escala (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_escala        UUID REFERENCES escalas_servicos(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,
  horario_previsto TIME,
  concluida        BOOLEAN DEFAULT FALSE,
  hora_conclusao   TIMESTAMPTZ,
  ordem            INT DEFAULT 0
);

-- ============================================================
-- 7. DIÁRIO DE CUIDADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS diario_cuidados (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_escala               UUID REFERENCES escalas_servicos(id) ON DELETE CASCADE,
  horario                 TIMESTAMPTZ DEFAULT NOW(),
  -- Sinais vitais
  batimento_cardiaco      INT,       -- bpm
  pressao_arterial        TEXT,      -- ex: "120/80"
  temperatura             NUMERIC(4,1),  -- ºC
  saturacao_oxigenio      INT,       -- %
  glicemia                NUMERIC(5,1),  -- mg/dL
  -- Cuidados
  alimentacao             TEXT CHECK (alimentacao IN ('aceitou','recusou','parcial')),
  hidratacao              TEXT CHECK (hidratacao IN ('boa','regular','insuficiente')),
  medicamento_ministrado  BOOLEAN DEFAULT FALSE,
  medicamentos_lista      TEXT,      -- quais medicamentos foram dados
  banho_realizado         BOOLEAN DEFAULT FALSE,
  humor                   TEXT CHECK (humor IN ('otimo','bom','regular','agitado','sonolento','triste')),
  -- Mídia e notas
  foto_url                TEXT,
  observacoes             TEXT,
  visivel_familia         BOOLEAN DEFAULT TRUE,
  criado_em               TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. AVALIAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS avaliacoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_escala    UUID REFERENCES escalas_servicos(id),
  id_cuidador  UUID REFERENCES cuidadores(id),
  id_cliente   UUID REFERENCES clientes_familia(id),
  nota         INT CHECK (nota BETWEEN 1 AND 5),
  comentario   TEXT,
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_escalas_cuidador   ON escalas_servicos(id_cuidador);
CREATE INDEX IF NOT EXISTS idx_escalas_idoso      ON escalas_servicos(id_idoso);
CREATE INDEX IF NOT EXISTS idx_escalas_status     ON escalas_servicos(status);
CREATE INDEX IF NOT EXISTS idx_escalas_data       ON escalas_servicos(data_inicio, data_termino);
CREATE INDEX IF NOT EXISTS idx_diario_escala      ON diario_cuidados(id_escala);
CREATE INDEX IF NOT EXISTS idx_idosos_cliente     ON idosos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo      ON usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant    ON usuarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug       ON tenants(slug);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_familia   ENABLE ROW LEVEL SECURITY;
ALTER TABLE idosos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuidadores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas_servicos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE atividades_escala  ENABLE ROW LEVEL SECURITY;
ALTER TABLE diario_cuidados    ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes         ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajuste conforme necessidade de segurança)
-- Admins têm acesso total
CREATE POLICY "admin_all" ON usuarios
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.auth_id = auth.uid() AND u.tipo = 'administrador'
    )
  );

-- Usuário pode ler/editar seus próprios dados
CREATE POLICY "proprio_usuario" ON usuarios
  FOR SELECT USING (auth_id = auth.uid());

-- ============================================================
-- TRIGGER: atualizar campo atualizado_em automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_atualizado
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TRIGGER trg_idosos_atualizado
  BEFORE UPDATE ON idosos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TRIGGER trg_cuidadores_atualizado
  BEFORE UPDATE ON cuidadores
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

CREATE TRIGGER trg_escalas_atualizado
  BEFORE UPDATE ON escalas_servicos
  FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();

-- ============================================================
-- DADOS DE EXEMPLO (comentar em produção)
-- ============================================================
/*
INSERT INTO usuarios (nome, email, tipo) VALUES
  ('Admin CuideLar', 'admin@cuideLar.com.br', 'administrador'),
  ('Maria Souza', 'maria@cuideLar.com.br', 'cuidador'),
  ('João Família', 'joao@email.com', 'cliente');
*/

-- ============================================================
-- MIGRATION NOTES (Para bancos de dados já existentes)
-- ============================================================
-- Executar caso o banco já esteja criado para adicionar as colunas do novo público:
-- ALTER TABLE idosos ADD COLUMN IF NOT EXISTS perfil TEXT CHECK (perfil IN ('idoso', 'crianca_autista')) DEFAULT 'idoso' NOT NULL;
-- ALTER TABLE cuidadores ADD COLUMN IF NOT EXISTS publico_atendido TEXT[] DEFAULT ARRAY['idoso']::TEXT[] NOT NULL;

-- ============================================================
-- FUNÇÃO RPC DE CADASTRO SEGURO (Cuidadoras e Famílias)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  v_is_admin BOOLEAN;
BEGIN
  -- Verificar se o usuário autenticado que está chamando a função é administrador
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE (
      u.auth_id = auth.uid() OR 
      u.id = auth.uid() OR 
      (auth.jwt()->>'email' IS NOT NULL AND lower(u.email) = lower(auth.jwt()->>'email'))
    ) AND u.tipo = 'administrador'
  ) INTO v_is_admin;

  -- Se houver administradores cadastrados e o chamador for autenticado mas não for admin, bloqueia
  IF (auth.uid() IS NOT NULL OR auth.jwt() IS NOT NULL) AND EXISTS (SELECT 1 FROM public.usuarios WHERE tipo = 'administrador') AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem criar novos usuários.';
  END IF;

  -- Se o usuário com este e-mail já existir na public.usuarios, retorna o ID existente (idempotência)
  SELECT id INTO v_user_id FROM public.usuarios WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;

  -- Obter o instance_id atual do projeto
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;

  -- 1. Insere o usuário na tabela auth.users do Supabase
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
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    phone_change_token,
    reauthentication_token
  ) VALUES (
    v_instance_id,
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_senha, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    ''
  ) RETURNING id INTO v_auth_id;

  -- 2. Insere na tabela auth.identities para associar o provedor de e-mail ao GoTrue
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

  -- 3. Insere na tabela public.usuarios (Retornando o ID público correto)
  INSERT INTO public.usuarios (auth_id, nome, email, tipo, ativo)
  VALUES (v_auth_id, p_nome, p_email, p_tipo, true)
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- ALTERAÇÕES PARA O BLOCO FINANCEIRO NAS ESCALAS DE SERVIÇO
-- ============================================================
ALTER TABLE public.escalas_servicos 
ADD COLUMN IF NOT EXISTS tipo_cobranca TEXT CHECK (tipo_cobranca IN ('Por Plantão', 'Por Plantão (12h)', 'Por Plantão (24h)', 'Por Hora', 'Mensal Fixado')) DEFAULT 'Por Hora',
ADD COLUMN IF NOT EXISTS valor_cliente NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_repasse_cuidador NUMERIC(10,2) DEFAULT 0;

ALTER TABLE public.cuidadores
ADD COLUMN IF NOT EXISTS porcentagem_agencia NUMERIC(5,2) DEFAULT 20.00;

ALTER TABLE public.escalas_servicos 
ADD COLUMN IF NOT EXISTS frequencia_escala TEXT DEFAULT '12x36';

-- ============================================================
-- TABELA DE PLANTÕES DIÁRIOS (DESMEMBRAMENTO DE ESCALAS MENSAIS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plantoes_diarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escala_pai_id UUID REFERENCES public.escalas_servicos(id) ON DELETE CASCADE,
    id_idoso UUID REFERENCES public.idosos(id) ON DELETE CASCADE,
    id_cuidador UUID REFERENCES public.cuidadores(id) ON DELETE CASCADE,
    data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('agendado', 'em_andamento', 'concluido', 'substituido', 'cancelado')) DEFAULT 'agendado',
    e_substituicao BOOLEAN DEFAULT false,
    cuidador_substituta_id UUID REFERENCES public.cuidadores(id) ON DELETE SET NULL,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.plantoes_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura total em plantoes_diarios" ON public.plantoes_diarios FOR SELECT USING (true);
CREATE POLICY "Escrita total em plantoes_diarios" ON public.plantoes_diarios FOR ALL USING (true);
