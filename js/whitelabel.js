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

// Detectar slug do tenant
function detectTenantSlug() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('tenant')) {
    const slug = params.get('tenant').toLowerCase().trim();
    console.log('[WL] Tenant via URL param:', slug);
    return slug;
  }
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (!['www', 'app', 'localhost', 'vercel'].includes(sub)) {
      console.log('[WL] Tenant via subdomain:', sub);
      return sub;
    }
  }
  return DEFAULT_TENANT.slug;
}

// Buscar dados via Supabase REST API (fetch nativo)
async function fetchTenantFromDB(slug) {
  try {
    const url = SUPABASE_URL + '/rest/v1/tenants?slug=eq.' + encodeURIComponent(slug) + '&select=slug,nome,url_logo,cor_primaria,cor_secundaria,emoji_logo,slogan&limit=1';
    console.log('[WL] Fetching:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Accept':        'application/json',
      },
    });
    console.log('[WL] HTTP status:', response.status);
    if (!response.ok) {
      console.warn('[WL] HTTP error', response.status);
      return null;
    }
    const data = await response.json();
    console.log('[WL] Data received:', data);
    if (!data || data.length === 0) {
      console.warn('[WL] Tenant nao encontrado:', slug);
      return null;
    }
    return data[0];
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

// Aplicar branding na pagina
function applyBranding(tenant) {
  const t = Object.assign({}, DEFAULT_TENANT, tenant);
  window.__tenant = t;
  console.log('[WL] Applying branding:', t.nome, t.cor_primaria);

  const root = document.documentElement;
  root.style.setProperty('--brand-dark',       t.cor_primaria);
  root.style.setProperty('--brand-rose',       t.cor_secundaria);
  root.style.setProperty('--primary-500',      t.cor_primaria);
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
  if (logoMark) logoMark.textContent = t.url_logo ? '' : t.emoji_logo;
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

// Export para uso do admin
export async function reloadBranding(tenantData) {
  sessionStorage.removeItem(CACHE_KEY);
  applyBranding(tenantData);
  saveCache(tenantData.slug, tenantData);
}

// Init
async function init() {
  const slug = detectTenantSlug();
  if (slug === DEFAULT_TENANT.slug) { applyBranding(DEFAULT_TENANT); return; }
  const cached = loadCache(slug);
  if (cached) { console.log('[WL] Cache hit:', slug); applyBranding(cached); return; }
  applyBranding(DEFAULT_TENANT);
  const dbData = await fetchTenantFromDB(slug);
  if (dbData) { saveCache(slug, dbData); applyBranding(dbData); console.log('[WL] OK:', dbData.nome); }
  else { console.warn('[WL] Usando padrao (tenant nao encontrado)'); }
}

await init();
