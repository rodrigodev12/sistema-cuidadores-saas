/**
 * Cuidelar — Supabase Client
 * MODO DEMO: Quando SUPABASE_URL começa com 'https://SEU_PROJETO',
 * o módulo exporta stubs seguros que não fazem chamadas de rede.
 */

const SUPABASE_URL      = 'https://qfgmpxevmamfxjxcbfrh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmZ21weGV2bWFtZnhqeGNiZnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3OTkxMDMsImV4cCI6MjEwMjM3NTEwM30.GVY80mUqMKJjf-9zozITq2FOWhUO9owGJxepuxNbJ3c';

export const DEMO_MODE = false;

// ============================================================
// STUB SEGURO (sem Supabase configurado)
// ============================================================
const stubAuth = {
  getSession: async () => ({ data: { session: null }, error: null }),
  signInWithPassword: async () => ({ data: null, error: { message: 'Demo mode' } }),
  signOut: async () => {},
};

const stubStorage = {
  from: () => ({
    upload: async () => ({ error: null }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
  }),
};

const stubChannel = {
  on: function() { return this; },
  subscribe: function() { return this; },
  unsubscribe: function() {},
};

function makeQueryBuilder(defaultData) {
  const builder = {
    _data: defaultData,
    select: function() { return this; },
    insert: async function() { return { data: this._data, error: null }; },
    update: async function() { return { data: this._data, error: null }; },
    upsert: async function() { return { data: this._data, error: null }; },
    delete: async function() { return { data: null, error: null }; },
    eq:     function() { return this; },
    neq:    function() { return this; },
    gte:    function() { return this; },
    lte:    function() { return this; },
    in:     function() { return this; },
    order:  function() { return this; },
    limit:  function() { return this; },
    single: async function() { return { data: null, error: null }; },
    // Tornamos a cadeia thenable para casos como "const { data } = await supabase.from(...)"
    then: function(resolve) {
      resolve({ data: this._data, error: null, count: 0 });
      return this;
    },
  };
  return builder;
}

const stubDB = {
  from: (table) => makeQueryBuilder([]),
  channel: () => stubChannel,
};

// ============================================================
// CLIENTE REAL (Supabase configurado)
// ============================================================
let supabaseReal = null;

async function loadRealClient() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabaseReal = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: true, persistSession: true },
  });
  return supabaseReal;
}

// ============================================================
// EXPORT: supabase (objeto unificado)
// ============================================================
export const supabase = DEMO_MODE
  ? { auth: stubAuth, storage: stubStorage, from: stubDB.from, channel: stubDB.channel }
  : await loadRealClient().catch(() => ({ auth: stubAuth, storage: stubStorage, from: stubDB.from, channel: stubDB.channel }));

// ============================================================
// Helpers (funcionam em demo e em real)
// ============================================================

export async function getUserProfile(authId) {
  if (DEMO_MODE) return null;
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', authId)
    .single();
  if (error) return null;
  return data;
}

export async function getIdososByCliente(clienteId) {
  if (DEMO_MODE) return [];
  const { data } = await supabase.from('idosos').select('*').eq('id_cliente', clienteId).eq('ativo', true).order('nome');
  return data || [];
}

export async function getEscalas(filters = {}) {
  if (DEMO_MODE) return [];
  let query = supabase.from('escalas_servicos').select(`*, idosos(id,nome,foto_url), cuidadores(id,valor_hora,usuarios(id,nome,avatar_url))`).order('data_inicio', { ascending: true });
  if (filters.status)      query = query.eq('status', filters.status);
  if (filters.id_cuidador) query = query.eq('id_cuidador', filters.id_cuidador);
  if (filters.id_idoso)    query = query.eq('id_idoso', filters.id_idoso);
  const { data } = await query;
  return data || [];
}

export async function getCuidadoresAtivos() {
  if (DEMO_MODE) return [];
  const { data } = await supabase.from('cuidadores').select('*, usuarios(id,nome,email,avatar_url)').eq('status','ativo');
  return data || [];
}

export async function getDiarioCuidados(escalaid) {
  if (DEMO_MODE) return [];
  const { data } = await supabase.from('diario_cuidados').select('*').eq('id_escala', escalaid).order('horario', { ascending: false });
  return data || [];
}

export async function insertDiario(registro) {
  if (DEMO_MODE) return registro;
  const { data, error } = await supabase.from('diario_cuidados').insert(registro).select().single();
  if (error) throw error;
  return data;
}

export async function registrarCheckin(escalaid, lat, lng) {
  if (DEMO_MODE) return {};
  const { data, error } = await supabase.from('escalas_servicos').update({ checkin_hora: new Date().toISOString(), checkin_lat: lat, checkin_lng: lng, status: 'em_andamento' }).eq('id', escalaid).select().single();
  if (error) throw error;
  return data;
}

export async function registrarCheckout(escalaid, lat, lng) {
  if (DEMO_MODE) return {};
  const { data, error } = await supabase.from('escalas_servicos').update({ checkout_hora: new Date().toISOString(), checkout_lat: lat, checkout_lng: lng, status: 'concluido' }).eq('id', escalaid).select().single();
  if (error) throw error;
  return data;
}

export async function uploadFoto(file, bucket, path) {
  if (DEMO_MODE) return URL.createObjectURL(file);
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function listenDiario(escalaid, callback) {
  if (DEMO_MODE) return stubChannel;
  return supabase.channel(`diario:${escalaid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'diario_cuidados', filter: `id_escala=eq.${escalaid}` }, (p) => callback(p.new))
    .subscribe();
}

export async function signUpWithoutLogin(email, password) {
  if (DEMO_MODE) return { data: { user: { id: 'demo-' + Math.random() } }, error: null };
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return await tempClient.auth.signUp({ email, password });
}
