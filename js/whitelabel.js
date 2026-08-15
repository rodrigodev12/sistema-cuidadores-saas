/**
 * Cuidelar — White Label / Marca Branca
 * ============================================================
 * Detecta o tenant (agência) via subdomínio ou parâmetro URL,
 * busca as configurações no Supabase e aplica dinamicamente:
 *   • Logotipo (img src ou emoji fallback)
 *   • Nome da agência
 *   • Cores primária e secundária (CSS custom properties)
 *   • Slogan na tela de login
 *   • Título da aba do navegador
 *
 * Uso em qualquer página HTML:
 *   <script type="module" src="js/whitelabel.js"></script>
 *
 * O objeto com os dados do tenant fica disponível em:
 *   window.__tenant
 * ============================================================
 */

// ─── Configuração padrão (fallback Cuidelar) ─────────────────
const DEFAULT_TENANT = {
  slug:           'cuidelar',
  nome:           'Cuidelar',
  url_logo:       'assets/logo-cuidelar.png',
  cor_primaria:   '#5C3C67',
  cor_secundaria: '#E07A8A',
  emoji_logo:     '🏠',
  slogan:         'Cuidado humanizado, gestão inteligente',
};

// ─── Detectar slug do tenant ──────────────────────────────────
function detectTenantSlug() {
  // 1. Parâmetro URL: ?tenant=agenciaxyz  (dev / Vercel preview / demo)
  const params = new URLSearchParams(window.location.search);
  if (params.get('tenant')) return params.get('tenant').toLowerCase().trim();

  // 2. Subdomínio: agenciaxyz.seusaas.com.br
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    // Ignora subdomínios genéricos
    if (!['www', 'app', 'localhost', 'vercel'].includes(sub)) return sub;
  }

  // 3. Fallback: tenant padrão
  return DEFAULT_TENANT.slug;
}

// ─── Buscar dados no Supabase ─────────────────────────────────
async function fetchTenantFromDB(slug) {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const SUPABASE_URL      = 'https://qfgmpxevmamfxjxcbfrh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZ21weGV2bWFtZnhqeGNiZnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTkxMDMsImV4cCI6MjA5OTU4NjM2MX0.GVY80mUqMKJjf-9zozITq2FOWhUO9owGJxepuxNbJ3c';

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('tenants')
      .select('slug, nome, url_logo, cor_primaria, cor_secundaria, emoji_logo, slogan')
      .eq('slug', slug)
      .eq('ativo', true)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Aplicar branding na página ───────────────────────────────
function applyBranding(tenant) {
  const t = { ...DEFAULT_TENANT, ...tenant };
  window.__tenant = t;

  // 1. CSS Custom Properties (cores)
  const root = document.documentElement;
  root.style.setProperty('--brand-dark',        t.cor_primaria);
  root.style.setProperty('--brand-rose',        t.cor_secundaria);
  root.style.setProperty('--primary-500',       t.cor_primaria);
  root.style.setProperty('--primary-600',       shadeColor(t.cor_primaria, -10));
  root.style.setProperty('--primary-700',       shadeColor(t.cor_primaria, -20));
  root.style.setProperty('--bg-sidebar',        t.cor_primaria);
  root.style.setProperty('--gradient-primary',  `linear-gradient(135deg, ${t.cor_primaria}, ${t.cor_secundaria})`);
  root.style.setProperty('--gradient-sidebar',  `linear-gradient(180deg, ${t.cor_primaria} 0%, ${shadeColor(t.cor_primaria, -10)} 100%)`);
  root.style.setProperty('--border-focus',      t.cor_secundaria);
  root.style.setProperty('--wl-primary',        t.cor_primaria);
  root.style.setProperty('--wl-secondary',      t.cor_secundaria);

  // 2. Título da aba
  if (document.title.includes('—')) {
    const pageTitle = document.title.split('—')[1]?.trim() || '';
    document.title = `${t.nome} — ${pageTitle}`;
  } else {
    document.title = t.nome;
  }

  // 3. Elementos de logo nos dashboards
  _applyLogoElements(t);

  // 4. Elementos específicos da tela de LOGIN
  _applyLoginBranding(t);

  // 5. Emitir evento para scripts que aguardam o branding
  document.dispatchEvent(new CustomEvent('whitelabel:ready', { detail: t }));
}

// ─── Aplicar logo em elementos genéricos (dashboards) ─────────
function _applyLogoElements(t) {
  // Sidebar logo (dashboard-admin)
  const logoMark = document.getElementById('sidebarLogoMark');
  const logoText = document.getElementById('sidebarLogoText');
  if (logoMark) {
    if (t.url_logo) {
      logoMark.innerHTML = `<img src="${t.url_logo}" alt="${t.nome}" class="sidebar-logo-img" onerror="this.style.display='none';this.nextSibling&&(this.nextSibling.style.display='inline')"><span style="display:none">${t.emoji_logo}</span>`;
    } else {
      logoMark.textContent = t.emoji_logo;
    }
  }
  if (logoText) logoText.textContent = t.nome;

  // Header logo (dashboard-cuidador e dashboard-familia)
  const headerLogo  = document.getElementById('headerLogoText');
  const headerEmoji = document.getElementById('headerLogoEmoji');
  const headerImg   = document.getElementById('headerLogoImg');

  if (headerLogo)  headerLogo.textContent  = t.nome;
  if (headerEmoji) headerEmoji.textContent = t.url_logo ? '' : t.emoji_logo;
  if (headerImg) {
    if (t.url_logo) {
      headerImg.src   = t.url_logo;
      headerImg.alt   = t.nome;
      headerImg.style.display = 'block';
      headerImg.onerror = () => {
        headerImg.style.display = 'none';
        if (headerEmoji) headerEmoji.textContent = t.emoji_logo;
      };
    } else {
      headerImg.style.display = 'none';
      if (headerEmoji) headerEmoji.textContent = t.emoji_logo;
    }
  }
}

// ─── Aplicar branding específico do Login ─────────────────────
function _applyLoginBranding(t) {
  // Logo no painel do formulário (direita)
  const loginLogoImg      = document.getElementById('loginLogoImg');
  const loginLogoFallback = document.getElementById('loginLogoFallback');
  const loginLogoIcon     = document.getElementById('loginLogoIcon');
  const loginLogoName     = document.getElementById('loginLogoName');

  if (loginLogoImg) {
    if (t.url_logo) {
      loginLogoImg.src = t.url_logo;
      loginLogoImg.alt = t.nome;
      loginLogoImg.style.display = 'block';
      loginLogoImg.onerror = () => {
        loginLogoImg.style.display = 'none';
        if (loginLogoFallback) loginLogoFallback.style.display = 'flex';
        if (loginLogoIcon)     loginLogoIcon.textContent = t.emoji_logo;
        if (loginLogoName)     loginLogoName.textContent = t.nome;
      };
    } else {
      loginLogoImg.style.display = 'none';
      if (loginLogoFallback) loginLogoFallback.style.display = 'flex';
      if (loginLogoIcon)     loginLogoIcon.textContent = t.emoji_logo;
      if (loginLogoName)     loginLogoName.textContent = t.nome;
    }
  }

  // Branding panel esquerdo
  const brandLogoMark = document.getElementById('brandLogoMark');
  const brandLogoText = document.getElementById('brandLogoText');
  const brandSlogan   = document.getElementById('brandSlogan');

  if (brandLogoMark) brandLogoMark.textContent = t.emoji_logo;
  if (brandLogoText) brandLogoText.textContent = t.nome;
  if (brandSlogan)   brandSlogan.textContent   = t.slogan;

  // Rodapé do formulário
  const loginFooterBrand = document.getElementById('loginFooterBrand');
  if (loginFooterBrand) loginFooterBrand.textContent = t.nome;
}

// ─── Utilitário: escurecer / clarear cor hex ──────────────────
function shadeColor(hex, percent) {
  try {
    const cleaned = hex.replace('#', '');
    const num = parseInt(cleaned, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(percent * 2.55)));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(percent * 2.55)));
    const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(percent * 2.55)));
    return `rgb(${r},${g},${b})`;
  } catch {
    return hex;
  }
}

// ─── Cache via sessionStorage ──────────────────────────────────
const CACHE_KEY = 'wl_tenant_config';

function saveCache(slug, data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ slug, data, ts: Date.now() }));
  } catch {}
}

function loadCache(slug) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    // Cache válido por 10 minutos
    if (cached.slug === slug && Date.now() - cached.ts < 10 * 60 * 1000) return cached.data;
  } catch {}
  return null;
}

// ─── Função pública: recarregar branding (uso do admin ao salvar) ──
export async function reloadBranding(tenantData) {
  applyBranding(tenantData);
  saveCache(tenantData.slug, tenantData);
}

// ─── Inicialização ────────────────────────────────────────────
async function init() {
  const slug = detectTenantSlug();

  // Se for o padrão, aplica diretamente sem consultar o banco
  if (slug === DEFAULT_TENANT.slug) {
    applyBranding(DEFAULT_TENANT);
    return;
  }

  // Checa cache primeiro (navegação entre páginas é instantânea)
  const cached = loadCache(slug);
  if (cached) {
    applyBranding(cached);
    return;
  }

  // Aplica o padrão enquanto carrega (sem flash)
  applyBranding(DEFAULT_TENANT);

  // Busca os dados reais no banco
  const dbData = await fetchTenantFromDB(slug);
  if (dbData) {
    saveCache(slug, dbData);
    applyBranding(dbData);
  }
}

init();
