# 🏠 CuideLar — Sistema de Cuidados para Idosos

Plataforma completa de gestão de cuidados para idosos, conectando famílias, cuidadores e administradores com tecnologia, transparência e segurança.

---

## 📁 Estrutura do Projeto

```
Sistema CuideLar/
├── index.html              → Tela de Login (ponto de entrada)
├── dashboard-admin.html    → Painel do Administrador
├── dashboard-cuidador.html → Painel do Cuidador (mobile-first)
├── dashboard-familia.html  → Painel da Família
├── css/
│   ├── global.css          → Design System completo (tokens, componentes)
│   ├── login.css           → Estilos da tela de login
│   ├── admin.css           → Estilos do painel admin
│   ├── cuidador.css        → Estilos do painel cuidador
│   └── familia.css         → Estilos do painel família
├── js/
│   ├── supabase-client.js  → Cliente Supabase + helpers de banco
│   └── auth.js             → Autenticação e proteção de rotas
├── assets/
│   └── favicon.svg
└── supabase/
    └── schema.sql          → Script SQL completo do banco de dados
```

---

## 🚀 Como Configurar

### 1. Criar Projeto no Supabase

1. Acesse [https://app.supabase.com](https://app.supabase.com) e crie um novo projeto
2. Vá em **SQL Editor** e execute o conteúdo de `supabase/schema.sql`
3. Copie a **Project URL** e a **anon/public key** em: Settings → API

### 2. Configurar Credenciais

Abra `js/supabase-client.js` e substitua:

```js
const SUPABASE_URL      = 'https://SEU_PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY_AQUI';
```

### 3. Executar Localmente

O sistema é HTML/CSS/JS puro — basta abrir `index.html` em qualquer servidor estático:

```bash
# Com Python
python -m http.server 8080

# Com Node.js (npx serve)
npx serve .

# Ou simplesmente arraste index.html para o browser
```

---

## 📊 Banco de Dados

| Tabela | Descrição |
|---|---|
| `usuarios` | Todos os usuários (admin, cuidador, cliente) |
| `clientes_familia` | Dados dos familiares responsáveis |
| `idosos` | Cadastro completo dos idosos |
| `cuidadores` | Cuidadores com disponibilidade e valor/hora |
| `escalas_servicos` | Plantões com check-in/out e geolocalização |
| `atividades_escala` | Checklist de tarefas por plantão |
| `diario_cuidados` | Registros de sinais vitais e cuidados |
| `avaliacoes` | Avaliações da família sobre os cuidadores |

---

## 🎨 Design System

- **Framework**: CSS Vanilla com Custom Properties (sem Tailwind)
- **Tema**: Dark mode premium com glassmorphism
- **Paleta**: Índigo (#4F46E5) + Ciano (#06B6D4) + Dark Navy (#0F172A)
- **Tipografia**: Outfit (display) + Inter (body) — Google Fonts
- **Ícones**: Lucide Icons (CDN)
- **Gráficos**: Chart.js
- **Calendário**: FullCalendar.js

---

## 🔑 Painéis de Acesso

| Perfil | Acesso | Arquivo |
|---|---|---|
| **Administrador** | Gestão total: cuidadores, idosos, escalas, relatórios | `dashboard-admin.html` |
| **Cuidador** | Mobile: check-in GPS, checklist, diário de cuidados | `dashboard-cuidador.html` |
| **Família** | Feed ao vivo, perfil do idoso, faturamento, avaliação | `dashboard-familia.html` |

---

## 📱 Funcionalidades por Painel

### 🔷 Administrador
- Dashboard com KPIs, gráficos de faturamento e alertas
- Agenda Global com FullCalendar (drag-and-drop de escalas)
- CRUD completo de Idosos, Cuidadores e Famílias
- Gestão de Escalas com filtros por status
- Relatórios financeiros com exportação

### 🟢 Cuidador (Mobile-First)
- Painel "Meu Dia" com plantão atual e dados do idoso
- Check-in/Check-out com GPS e cronômetro
- Checklist de atividades do plantão com progresso
- Diário de cuidados: sinais vitais, alimentação, medicamentos, foto

### 🟡 Família
- Feed em tempo real (Supabase Realtime) dos registros do cuidador
- Perfil completo de saúde do idoso
- Agenda de próximos plantões
- Histórico de faturamento
- Avaliação do cuidador com estrelas

---

## 🔒 Segurança

- Row Level Security (RLS) habilitado em todas as tabelas
- Autenticação via Supabase Auth (email/senha)
- Redirecionamento automático por tipo de usuário
- Proteção de rotas no lado do cliente

---

## 🗺️ Próximos Passos (Fase 2)

- [ ] App Flutter nativo para cuidadores
- [ ] Integração com gateway de pagamento (Asaas ou PagSeguro)
- [ ] Módulo de contratos com assinatura digital
- [ ] Notificações push via Supabase Edge Functions
- [ ] Exportação de relatórios em PDF
- [ ] Módulo de gestão de documentos (CNH, certificados)

---

*CuideLar © 2025 — Todos os direitos reservados*
