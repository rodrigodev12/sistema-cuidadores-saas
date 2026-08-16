/**
 * Cuidelar — White Label / Marca Branca  v2
 * ============================================================
 * Detecta o tenant via subdomínio ou ?tenant=slug,
 * busca as configs via Supabase REST API (fetch nativo, sem import),
 * e aplica logo, nome e cores dinamicamente em todas as páginas.
 * ============================================================
 */

const SUPABASE_URL      = 'https://qfgmpxevmamfxjxcbfrh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZ21weGV2bWFtZnhqeGNiZnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTkxMDMsImV4cCI6MjEwMjM3NTEwM30.GVY80mUqMKJjf-9zozITq2FOWhUO9owGJxepuxNbJ3c';

// Configuração padrão (fallback Cuidelar)
const DEFAULT_TENANT = {
  slug:           'cuidelar',
  nome:           'Cuidelar',
  url_logo:       'assets/logo-cuidelar.png',
  cor_primaria:   '#5C3C67',
  cor_secundaria: '#E07A8A',
  emoji_logo:     String.fromCodePoint(0x1F3E0),
  slogan:         'Cuidado humanizado, gestao inteligente',
};

// Detectar slug do tenant (Subpasta, URL param ?tenant=slug, Subdomínio ou LocalStorage)
function detectTenantSlug() {
  // 1. URL search param ?tenant=slug
  const params = new URLSearchParams(window.location.search);
  if (params.get('tenant')) {
    let slug = params.get('tenant').toLowerCase().trim();
    slug = slug.split('?')[0].split('&')[0].split('%3F')[0];
    console.log('[WL] Tenant via URL param:', slug);
    return slug;
  }

  // 2. Tenant do perfil do usuário em localStorage
  try {
    const rawUser = localStorage.getItem('cuidelar_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u && u.tenant && u.tenant.slug) {
        console.log('[WL] Tenant via cuidelar_user profile:', u.tenant.slug);
        return u.tenant.slug;
      }
      if (u && u.tenant_slug) {
        console.log('[WL] Tenant via cuidelar_user slug:', u.tenant_slug);
        return u.tenant_slug;
      }
    }
  } catch {}

  // 3. Subpasta na URL (/agencia-xyz/login ou /agenciaxyz)
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0) {
    const firstSeg = pathSegments[0].toLowerCase().trim();
    const systemPaths = [
      'index.html', 'dashboard-admin.html', 'dashboard-cuidador.html',
      'dashboard-familia.html', 'apresentacao-comercial.html', 'apresentacao-familia.html',
      'assets', 'css', 'js', 'supabase', 'vercel.json', 'favicon.svg'
    ];
    if (!systemPaths.includes(firstSeg) && !firstSeg.endsWith('.html') && !firstSeg.endsWith('.js') && !firstSeg.endsWith('.css')) {
      console.log('[WL] Tenant via subpasta URL:', firstSeg);
      return firstSeg;
    }
  }

  // 4. Subdomínio (agenciaxyz.seusaas.com)
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (!['www', 'app', 'localhost', 'vercel'].includes(sub)) {
      console.log('[WL] Tenant via subdomain:', sub);
      return sub;
    }
  }

  // 5. Fallback: tenant salvo no localStorage após login
  const saved = localStorage.getItem('wl_tenant_slug');
  if (saved && saved !== DEFAULT_TENANT.slug) {
    console.log('[WL] Tenant via localStorage:', saved);
    return saved;
  }

  return DEFAULT_TENANT.slug;
}

// Buscar dados via Supabase REST API (fetch nativo)
async function fetchTenantFromDB(slug) {
  try {
    const cleanSlug = slug.split('?')[0].split('&')[0].split('%3F')[0];
    const url = SUPABASE_URL + '/rest/v1/tenants?slug=eq.' + encodeURIComponent(cleanSlug) + '&select=id,slug,nome,url_logo,cor_primaria,cor_secundaria,emoji_logo,slogan,status_assinatura,link_pagamento_asaas,vencimento_assinatura,valor_plano,plano_nome&limit=1';
    console.log('[WL] Fetching:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Accept':        'application/json',
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.length === 0) return null;

    const tenantData = data[0];
    if (tenantData.id) localStorage.setItem('tenant_id', tenantData.id);
    if (tenantData.status_assinatura) localStorage.setItem('wl_tenant_status', tenantData.status_assinatura);

    return tenantData;
  } catch (err) {
    console.error('[WL] Fetch error:', err);
    return null;
  }
}

// Escurecer cor hex
function darken(hex, amount) {
  try {
    const h = hex.replace('#', '');
    const num = parseInt(h, 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
  } catch { return hex; }
}

// Modal de bloqueio de acesso por inadimplência da assinatura Asaas
function checkSubscriptionStatus(t) {
  if (!t || t.status_assinatura !== 'bloqueada') {
    const existingModal = document.getElementById('wlBlockedSubscriptionModal');
    if (existingModal) existingModal.remove();
    return;
  }

  console.warn('[WL] ⚠️ Tenant bloqueado por inadimplência:', t.nome);
  if (document.getElementById('wlBlockedSubscriptionModal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'wlBlockedSubscriptionModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(15,10,25,0.88);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:1.5rem;font-family:sans-serif;';
  
  const payUrl = t.link_pagamento_asaas || '#';

  overlay.innerHTML = `
    <div style="background:#ffffff;color:#1e293b;border-radius:20px;max-width:500px;width:100%;padding:2rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);text-align:center;position:relative;">
      <div style="width:72px;height:72px;border-radius:50%;background:#fee2e2;color:#dc2626;display:flex;align-items:center;justify-content:center;font-size:2.2rem;margin:0 auto 1.25rem;">⚠️</div>
      <h2 style="font-size:1.5rem;font-weight:800;color:#991b1b;margin-bottom:0.5rem;">Assinatura Pendente de Pagamento</h2>
      <p style="color:#64748b;font-size:0.95rem;line-height:1.6;margin-bottom:1.5rem;">
        O acesso à plataforma para a agência <strong>${t.nome || 'cadastrada'}</strong> está temporariamente suspenso devido a pendência financeira.
      </p>
      <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:1rem;margin-bottom:1.5rem;text-align:left;font-size:0.875rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem;">
          <span style="color:#64748b;">Plano:</span>
          <strong style="color:#0f172a;">${t.plano_nome || 'Mensal Pro'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#64748b;">Valor Mensal:</span>
          <strong style="color:#16a34a;">R$ ${(t.valor_plano || 299).toFixed(2)}</strong>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.75rem;">
        <a href="${payUrl}" target="_blank" rel="noopener" style="display:block;width:100%;padding:0.9rem 1.25rem;background:linear-gradient(135deg,#dc2626,#991b1b);color:white;text-decoration:none;border-radius:12px;font-weight:700;font-size:1rem;box-shadow:0 4px 14px rgba(220,38,38,0.4);box-sizing:border-box;">
          💳 Pagar Fatura no Asaas e Liberar Acesso
        </a>
        <button onclick="sessionStorage.clear();localStorage.clear();location.href='index.html';" style="background:none;border:none;color:#64748b;font-size:0.85rem;cursor:pointer;padding:0.5rem;text-decoration:underline;">
          Sair da Conta / Trocar de Agência
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Desabilita botões de login se estiver na tela de login
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.disabled = true;
}

// Aplicar branding na pagina
function applyBranding(tenant) {
  const t = Object.assign({}, DEFAULT_TENANT, tenant);
  window.__tenant = t;
  console.log('[WL] Applying branding:', t.nome, t.cor_primaria);

  const root = document.documentElement;
  root.style.setProperty('--brand-dark',       t.cor_primaria);
  root.style.setProperty('--brand-rose',       t.cor_secundaria);
  root.style.setProperty('--primary-500',      t.cor_primaria);
  root.style.setProperty('--primary-color',   t.cor_primaria);
  root.style.setProperty('--secondary-color', t.cor_secundaria);
  root.style.setProperty('--logo-url',        t.url_logo ? `url("${t.url_logo}")` : 'none');
  root.style.setProperty('--bg-sidebar',       t.cor_primaria);
  root.style.setProperty('--gradient-primary', 'linear-gradient(135deg, ' + t.cor_primaria + ', ' + t.cor_secundaria + ')');
  root.style.setProperty('--gradient-sidebar', 'linear-gradient(180deg, ' + t.cor_primaria + ' 0%, ' + darken(t.cor_primaria, 15) + ' 100%)');
  root.style.setProperty('--border-focus',     t.cor_secundaria);
  root.style.setProperty('--wl-primary',       t.cor_primaria);
  root.style.setProperty('--wl-secondary',     t.cor_secundaria);

  const sep = document.title.indexOf('—');
  document.title = sep > -1 ? (t.nome + ' — ' + document.title.slice(sep + 2).trim()) : t.nome;

  // Sidebar (admin)
  const logoMark = document.getElementById('sidebarLogoMark');
  const logoText = document.getElementById('sidebarLogoText');
  if (logoMark) {
    if (t.url_logo) {
      logoMark.innerHTML = `<img src="${t.url_logo}" alt="${t.nome}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" onerror="this.parentElement.textContent='${t.emoji_logo || '🏠'}'" />`;
    } else {
      logoMark.textContent = t.emoji_logo || '🏠';
    }
  }
  if (logoText) logoText.textContent = t.nome;

  // Header (cuidador / familia)
  const headerLogo  = document.getElementById('headerLogoText');
  const headerEmoji = document.getElementById('headerLogoEmoji');
  const headerImg   = document.getElementById('headerLogoImg');
  if (headerLogo)  headerLogo.textContent  = t.nome;
  if (headerEmoji) headerEmoji.textContent = t.url_logo ? '' : t.emoji_logo;
  if (headerImg) {
    if (t.url_logo) {
      headerImg.src = t.url_logo; headerImg.alt = t.nome; headerImg.style.display = 'block';
    } else { headerImg.style.display = 'none'; }
  }

  // Login page
  const loginLogoImg      = document.getElementById('loginLogoImg');
  const loginLogoFallback = document.getElementById('loginLogoFallback');
  const loginLogoIcon     = document.getElementById('loginLogoIcon');
  const loginLogoName     = document.getElementById('loginLogoName');
  const brandLogoMark     = document.getElementById('brandLogoMark');
  const brandLogoText     = document.getElementById('brandLogoText');
  const brandSlogan       = document.getElementById('brandSlogan');
  const loginFooterBrand  = document.getElementById('loginFooterBrand');

  if (loginLogoImg) {
    if (t.url_logo) {
      loginLogoImg.src = t.url_logo; loginLogoImg.alt = t.nome; loginLogoImg.style.display = 'block';
    } else {
      loginLogoImg.style.display = 'none';
      if (loginLogoFallback) loginLogoFallback.style.display = 'flex';
      if (loginLogoIcon)     loginLogoIcon.textContent = t.emoji_logo;
      if (loginLogoName)     loginLogoName.textContent = t.nome;
    }
  }
  if (brandLogoMark)    brandLogoMark.textContent    = t.emoji_logo;
  if (brandLogoText)    brandLogoText.textContent    = t.nome;
  if (brandSlogan)      brandSlogan.textContent      = t.slogan || t.nome;
  if (loginFooterBrand) loginFooterBrand.textContent = t.nome;

  // Verifica se o acesso está bloqueado por falta de pagamento
  checkSubscriptionStatus(t);

  document.dispatchEvent(new CustomEvent('whitelabel:ready', { detail: t }));
}

// Cache sessionStorage
const CACHE_KEY = 'wl_tenant_v2';
function saveCache(slug, data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ slug, data, ts: Date.now() })); } catch {}
}
function loadCache(slug) {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.slug === slug && Date.now() - c.ts < 600000) return c.data;
  } catch {}
  return null;
}

// Export para uso do admin e hidratação direta
export function aplicarTemaBranco(configuracoesEmpresa) {
  applyBranding(configuracoesEmpresa);
}

export async function reloadBranding(tenantData) {
  sessionStorage.removeItem(CACHE_KEY);
  applyBranding(tenantData);
  saveCache(tenantData.slug, tenantData);
}

// Init
async function init() {
  const slug = detectTenantSlug();

  // Tenta aplicar o tenant do usuário logado em localStorage imediatamente
  try {
    const rawUser = localStorage.getItem('cuidelar_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u && u.tenant && (u.tenant.slug === slug || slug === DEFAULT_TENANT.slug)) {
        console.log('[WL] Aplicando branding do perfil do usuario:', u.tenant.nome);
        applyBranding(u.tenant);
        saveCache(u.tenant.slug, u.tenant);
      }
    }
  } catch {}

  const cached = loadCache(slug);
  if (cached) {
    console.log('[WL] Cache hit:', slug);
    applyBranding(cached);
    return;
  }

  // Busca do Supabase
  const dbData = await fetchTenantFromDB(slug);
  if (dbData) {
    saveCache(slug, dbData);
    applyBranding(dbData);
    console.log('[WL] OK:', dbData.nome);
  } else if (!window.__tenant) {
    applyBranding(DEFAULT_TENANT);
  }
}

await init();

// Listener: branding aplicado logo após login (sem depender de reload)
document.addEventListener('whitelabel:apply', (e) => {
  if (e.detail) {
    console.log('[WL] Branding aplicado via evento pós-login:', e.detail.nome);
    saveCache(e.detail.slug, e.detail);
    applyBranding(e.detail);
  }
});

