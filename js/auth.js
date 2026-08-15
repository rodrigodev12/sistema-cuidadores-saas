/**
 * Cuidelar — auth.js
 * Gerencia autenticação, sessão e redirecionamento por tipo de usuário.
 * Inclui MODO DEMO para testar sem Supabase configurado.
 */

import { supabase, getUserProfile, DEMO_MODE } from './supabase-client.js';

// ============================================================
// MODO DEMO
// Ativo quando o Supabase não está configurado.
// Credenciais de demonstração:
//   admin@cuidelar.com    / admin123
//   cuidador@cuidelar.com / cuida123
//   familia@cuidelar.com  / familia123
// ============================================================

const DEMO_USERS = {
  'admin@cuidelar.com': {
    senha: 'admin123',
    profile: { id: 'demo-admin', nome: 'Cuidelar', email: 'admin@cuidelar.com', tipo: 'administrador' }
  },
  'cuidador@cuidelar.com': {
    senha: 'cuida123',
    profile: { id: 'demo-cuidador', nome: 'Ana Paula Ferreira', email: 'cuidador@cuidelar.com', tipo: 'cuidador' }
  },
  'familia@cuidelar.com': {
    senha: 'familia123',
    profile: { id: 'demo-familia', nome: 'João Silva (Família)', email: 'familia@cuidelar.com', tipo: 'cliente' }
  },
};

// ============================================================
// Exporta utilitários de toast para uso global
// ============================================================
window.showToast = showToast;

// ============================================================
// REDIRECIONAMENTO POR TIPO DE USUÁRIO
// ============================================================
const REDIRECT_MAP = {
  administrador: 'dashboard-admin.html',
  cuidador:      'dashboard-cuidador.html',
  cliente:       'dashboard-familia.html',
};

function redirectToDashboard(tipo) {
  const page = REDIRECT_MAP[tipo];
  if (page) window.location.href = page;
}

// ============================================================
// SESSÃO DEMO
// ============================================================
function getDemoSession() {
  try {
    const raw = localStorage.getItem('cuidelar_demo_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setDemoSession(profile) {
  localStorage.setItem('cuidelar_demo_user', JSON.stringify(profile));
}

function clearDemoSession() {
  localStorage.removeItem('cuidelar_demo_user');
}

// ============================================================
// PROTEÇÃO DE ROTA
// Chame em cada dashboard: protectRoute(['administrador'])
// ============================================================
export async function protectRoute(allowedRoles) {
  if (DEMO_MODE) {
    const profile = getDemoSession();
    if (!profile) { window.location.href = 'index.html'; return null; }
    if (!allowedRoles.includes(profile.tipo)) { window.location.href = 'index.html'; return null; }
    return profile;
  }

  // Modo real — Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return null; }
    const profile = await getUserProfile(session.user.id);
    if (!profile || !allowedRoles.includes(profile.tipo)) { window.location.href = 'index.html'; return null; }
    return profile;
  } catch {
    window.location.href = 'index.html';
    return null;
  }
}

// ============================================================
// LOGOUT
// ============================================================
export async function logout() {
  if (DEMO_MODE) {
    clearDemoSession();
    window.location.href = 'index.html';
    return;
  }
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

window.cuidelarLogout = logout;

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-size:1.1rem">${icons[type] || icons.info}</span>
    <span style="font-size:0.9rem">${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'none';
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================
// FORMULÁRIO DE LOGIN
// ============================================================
const loginForm = document.getElementById('loginForm');

if (loginForm) {

  // Verifica se já tem sessão ativa
  if (DEMO_MODE) {
    const existing = getDemoSession();
    if (existing) redirectToDashboard(existing.tipo);
  } else {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const profile = await getUserProfile(session.user.id);
          if (profile) redirectToDashboard(profile.tipo);
        }
      } catch { /* ignora erro de Supabase não configurado */ }
    })();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email    = document.getElementById('emailInput').value.trim().toLowerCase();
    const password = document.getElementById('passwordInput').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorEl  = document.getElementById('loginError');

    if (!email || !password) {
      showLoginError('Preencha e-mail e senha para continuar.');
      return;
    }

    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    errorEl.classList.remove('visible');

    // Simula delay de autenticação
    await new Promise(r => setTimeout(r, 800));

    try {
      if (DEMO_MODE) {
        // ---- LOGIN DEMO ----
        const demoUser = DEMO_USERS[email];

        if (!demoUser || demoUser.senha !== password) {
          throw new Error('E-mail ou senha incorretos. Use as credenciais demo ao lado.');
        }

        setDemoSession(demoUser.profile);
        showToast(`Bem-vindo, ${demoUser.profile.nome.split(' ')[0]}! 🎉`, 'success', 2000);
        setTimeout(() => redirectToDashboard(demoUser.profile.tipo), 900);

      } else {
        // ---- LOGIN REAL — Supabase ----
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw new Error(mapAuthError(authError.message));

        const profile = await getUserProfile(authData.user.id);
        if (!profile) throw new Error('Perfil não encontrado. Contate o administrador.');

        setDemoSession(profile); // cache local
        showToast('Bem-vindo! Carregando painel...', 'success', 2000);
        setTimeout(() => redirectToDashboard(profile.tipo), 900);
      }

    } catch (err) {
      showLoginError(err.message || 'Erro ao realizar login.');
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  });
}

// ============================================================
// HELPERS
// ============================================================
function showLoginError(message) {
  const errorEl  = document.getElementById('loginError');
  const errorMsg = document.getElementById('loginErrorMsg');
  if (errorEl && errorMsg) {
    errorMsg.textContent = message;
    errorEl.classList.add('visible');
  }
}

function mapAuthError(message) {
  const map = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed':       'Confirme seu e-mail antes de continuar.',
    'Too many requests':         'Muitas tentativas. Aguarde alguns minutos.',
  };
  for (const [key, val] of Object.entries(map)) {
    if (message.includes(key)) return val;
  }
  return 'Erro ao fazer login. Verifique suas credenciais.';
}
