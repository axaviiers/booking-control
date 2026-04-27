import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = (url && key) ? createClient(url, key) : null

// ══════════════════════════════════════════
// LOG — tudo que acontece fica visível na UI
// ══════════════════════════════════════════
const _log = []
export function getLog() { return _log.slice(-30) }
function log(msg) {
  const t = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const entry = `[${t}] ${msg}`
  _log.push(entry)
  if (_log.length > 60) _log.shift()
  console.log(entry)
}

function c(d) {
  return `${(d?.bookings||[]).length}bk ${(d?.ships||[]).length}sh ${(d?.pendencias||[]).length}pd ${(d?.solicitacoes||[]).length}sl`
}

// ══════════════════════════════════════════
// TESTE COMPLETO DE CONEXÃO
// Testa: leitura, escrita, persistência
// ══════════════════════════════════════════
export async function testConnection() {
  if (!supabase) return { ok: false, error: 'Supabase não configurado' }
  
  // 1) Testa se a tabela existe
  log('🔍 Testando conexão...')
  const { data: row, error: readErr } = await supabase
    .from('shared_state').select('id, data').eq('id', 1).maybeSingle()
  
  if (readErr) {
    const msg = readErr.message || String(readErr)
    log('❌ LEITURA falhou: ' + msg)
    return { ok: false, error: 'Erro de leitura: ' + msg }
  }
  if (!row) {
    log('❌ Tabela vazia — nenhum registro')
    return { ok: false, error: 'Tabela shared_state existe mas está vazia' }
  }
  log('✓ Leitura OK — tabela acessível')

  // 2) Testa escrita
  const testMark = 'test_' + Date.now()
  const { error: writeErr } = await supabase
    .from('shared_state').update({ updated_by: testMark }).eq('id', 1)
  
  if (writeErr) {
    log('❌ ESCRITA falhou: ' + writeErr.message)
    return { ok: false, error: 'Leitura OK mas ESCRITA falhou: ' + writeErr.message }
  }

  // 3) Lê de volta para confirmar que persistiu
  const { data: check } = await supabase
    .from('shared_state').select('updated_by').eq('id', 1).maybeSingle()
  
  if (!check || check.updated_by !== testMark) {
    log('❌ ESCRITA NÃO PERSISTIU!')
    return { ok: false, error: 'Escrita não persistiu! Gravou mas ao ler voltou diferente.' }
  }

  log('✓ Escrita OK — dados persistem')
  return { ok: true, error: null }
}

// ══════════════════════════════════════════
// SAVE — O MAIS SIMPLES POSSÍVEL
// 1. Pega o estado local
// 2. Grava no Supabase (upsert simples, sem merge, sem versão)
// 3. Lê de volta
// 4. Se não bateu, tenta de novo
// ══════════════════════════════════════════
export async function saveState(state, userName) {
  if (!supabase) { log('⚠ Sem Supabase'); return { ok: false, reason: 'no-supabase' } }
  
  log('💾 Salvando... ' + c(state))

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // GRAVA — upsert simples, sem condição, sem versão
      const { error: wErr } = await supabase
        .from('shared_state')
        .upsert({
          id: 1,
          data: state,
          updated_at: new Date().toISOString(),
          updated_by: userName || 'system'
        }, { onConflict: 'id' })

      if (wErr) {
        log('❌ Escrita falhou #' + attempt + ': ' + wErr.message)
        if (attempt < 3) { await delay(1000); continue }
        return { ok: false, reason: wErr.message }
      }

      // VERIFICA — lê de volta e compara contagens
      const { data: verify, error: vErr } = await supabase
        .from('shared_state').select('data').eq('id', 1).maybeSingle()

      if (vErr || !verify || !verify.data) {
        log('⚠ Verificação falhou #' + attempt)
        if (attempt < 3) { await delay(1000); continue }
        return { ok: false, reason: 'verificação falhou' }
      }

      const savedBk = (verify.data.bookings || []).length
      const localBk = (state.bookings || []).length
      const savedSh = (verify.data.ships || []).length
      const localSh = (state.ships || []).length
      const savedPd = (verify.data.pendencias || []).length
      const localPd = (state.pendencias || []).length
      const savedSl = (verify.data.solicitacoes || []).length
      const localSl = (state.solicitacoes || []).length

      if (savedBk < localBk || savedSh < localSh || savedPd < localPd || savedSl < localSl) {
        log('🚨 DADOS PERDIDOS! Local: ' + localBk + 'bk ' + localSh + 'sh ' + localPd + 'pd ' + localSl + 'sl → Supabase: ' + savedBk + 'bk ' + savedSh + 'sh ' + savedPd + 'pd ' + savedSl + 'sl. Tentando #' + (attempt+1))
        if (attempt < 3) { await delay(1000); continue }
        return { ok: false, reason: 'dados não persistiram' }
      }

      log('✅ SALVO E VERIFICADO — ' + c(verify.data))
      return { ok: true, data: verify.data }

    } catch (e) {
      log('❌ Exceção #' + attempt + ': ' + (e?.message || e))
      if (attempt < 3) { await delay(1000); continue }
      return { ok: false, reason: e?.message || String(e) }
    }
  }
  return { ok: false, reason: 'falhou 3x' }
}

// ══════════════════════════════════════════
// LOAD — Lê do Supabase, fallback localStorage
// ══════════════════════════════════════════
export async function loadState() {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('shared_state').select('data').eq('id', 1).maybeSingle()
    if (error) { log('❌ Load falhou: ' + error.message); return null }
    if (!data || !data.data) { log('⚠ Load: sem dados'); return null }
    log('📥 Load Supabase: ' + c(data.data))
    return data.data
  } catch (e) { log('❌ Load exceção: ' + (e?.message||e)); return null }
}

// ── localStorage ──
export function loadLocalState() {
  try {
    const r = localStorage.getItem('booking-control-data')
    const d = r ? JSON.parse(r) : null
    if (d) log('📥 Load local: ' + c(d))
    return d
  } catch { return null }
}

export function saveLocalState(state) {
  try { localStorage.setItem('booking-control-data', JSON.stringify(state)) }
  catch (e) { log('⚠ Local save: ' + (e?.message||e)) }
}

// ══════════════════════════════════════════
// REALTIME — escuta mudanças de outros clientes
// ══════════════════════════════════════════
export function subscribeToChanges(callback) {
  if (!supabase) return () => {}
  const ch = supabase.channel('shared-state')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_state' }, (p) => {
      if (p.new?.data) { log('📡 Realtime recebido: ' + c(p.new.data)); callback(p.new.data) }
    })
    .subscribe()
  return () => supabase.removeChannel(ch)
}

// ── Helpers ──
function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Merge (simples: por id, mais recente vence) ──
function ts(item) { return (item?.updatedAt || item?.createdAt || 0) }
function isDel(item) { return !!(item && (item._purged || item.deletedAt || item._deleted)) }

function mergeArr(a, b) {
  const map = new Map()
  const put = (item) => {
    if (!item?.id) return
    const prev = map.get(item.id)
    if (!prev) { map.set(item.id, item); return }
    if (isDel(item) && !isDel(prev)) { map.set(item.id, item); return }
    if (isDel(prev) && !isDel(item)) return
    if (ts(item) > ts(prev)) map.set(item.id, item)
  }
  ;(a || []).forEach(put)
  ;(b || []).forEach(put)
  return Array.from(map.values())
}

export function mergeStates(a, b) {
  if (!a) return b; if (!b) return a
  return {
    bookings: mergeArr(a.bookings, b.bookings),
    pendencias: mergeArr(a.pendencias, b.pendencias),
    ships: mergeArr(a.ships, b.ships),
    solicitacoes: mergeArr(a.solicitacoes, b.solicitacoes),
    users: (b.users?.length) ? b.users : a.users,
    armadores: (b.armadores?.length) ? b.armadores : a.armadores,
    logo: b.logo !== undefined ? b.logo : a.logo,
  }
}

// ── Backups ──
const BK = 'booking-control-backups'
export function pushLocalBackup(s) {
  try { const l = JSON.parse(localStorage.getItem(BK)||'[]'); l.unshift({at:Date.now(),bookings:(s.bookings||[]).length,ships:(s.ships||[]).length,state:s}); localStorage.setItem(BK,JSON.stringify(l.slice(0,10))) } catch {}
}
export function listLocalBackups() { try { return JSON.parse(localStorage.getItem(BK)||'[]') } catch { return [] } }
export function clearLocalBackups() { try { localStorage.removeItem(BK) } catch {} }
