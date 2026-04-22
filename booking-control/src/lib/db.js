import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && key) ? createClient(url, key) : null

// ─── MERGE HELPERS ───
function ts(item) { return (item && (item.updatedAt || item.createdAt)) || 0 }
function isDel(item) { return !!(item && (item._purged || item.deletedAt || item._deleted)) }

function mergeCollection(remoteArr, localArr, itemMerger) {
  const map = new Map()
  const put = (item) => {
    if (!item || !item.id) return
    const prev = map.get(item.id)
    if (!prev) { map.set(item.id, item); return }
    if (itemMerger) { map.set(item.id, itemMerger(prev, item)); return }
    if (isDel(item) && !isDel(prev)) { map.set(item.id, item); return }
    if (isDel(prev) && !isDel(item)) return
    if (ts(item) > ts(prev)) map.set(item.id, item)
  }
  ;(remoteArr || []).forEach(put)
  ;(localArr  || []).forEach(put)
  return Array.from(map.values())
}

function mergeShip(a, b) {
  if (isDel(a) && !isDel(b)) return a
  if (isDel(b) && !isDel(a)) return b
  const newer = ts(b) >= ts(a) ? b : a
  const older = newer === a ? b : a
  return { ...newer, bookings: mergeCollection(older.bookings || [], newer.bookings || []) }
}

export function mergeStates(remote, local) {
  if (!remote) return local
  if (!local) return remote
  return {
    bookings: mergeCollection(remote.bookings, local.bookings),
    pendencias: mergeCollection(remote.pendencias, local.pendencias),
    ships: mergeCollection(remote.ships, local.ships, mergeShip),
    solicitacoes: mergeCollection(remote.solicitacoes, local.solicitacoes),
    users: (local.users && local.users.length) ? local.users : remote.users,
    armadores: (local.armadores && local.armadores.length) ? local.armadores : remote.armadores,
    logo: local.logo !== undefined ? local.logo : remote.logo,
  }
}

// ─── Contagens (para diagnóstico) ───
function counts(d) {
  return {
    bk: (d?.bookings || []).length,
    pd: (d?.pendencias || []).length,
    sh: (d?.ships || []).length,
    sl: (d?.solicitacoes || []).length,
  }
}

// ─── LOG de operações (visível no UI) ───
const _log = []
export function getLog() { return _log.slice(-20) }
function log(msg) {
  const entry = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`
  _log.push(entry)
  if (_log.length > 50) _log.shift()
  console.log(entry)
}

// ─── TESTE DE CONEXÃO (lê E escreve) ───
export async function testConnection() {
  if (!supabase) return { ok: false, error: 'Supabase não configurado (variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)' }
  try {
    // 1. Teste de LEITURA
    const { data, error } = await supabase
      .from('shared_state')
      .select('id, version, data')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      log('❌ TESTE LEITURA falhou: ' + error.message)
      if (error.message.includes('does not exist')) return { ok: false, error: 'Tabela shared_state NÃO EXISTE. Execute o SQL de correção.' }
      return { ok: false, error: 'Erro de leitura: ' + error.message }
    }
    if (!data) {
      log('❌ Tabela shared_state vazia')
      return { ok: false, error: 'Tabela shared_state vazia. Execute o SQL de correção.' }
    }

    log('✓ LEITURA ok — versão ' + data.version + ', ' + JSON.stringify(counts(data.data)))

    // 2. Teste de ESCRITA: atualiza updated_at sem mudar dados
    const testTs = new Date().toISOString()
    const { data: writeRes, error: writeErr } = await supabase
      .from('shared_state')
      .update({ updated_at: testTs })
      .eq('id', 1)
      .select('updated_at')

    if (writeErr) {
      log('❌ TESTE ESCRITA falhou: ' + writeErr.message)
      return { ok: false, error: 'Leitura OK mas ESCRITA falhou: ' + writeErr.message + '. Verifique as policies RLS.' }
    }
    if (!writeRes || writeRes.length === 0) {
      log('❌ ESCRITA não afetou nenhuma linha (RLS bloqueando?)')
      return { ok: false, error: 'ESCRITA bloqueada — a policy RLS está impedindo gravações. Execute o SQL de correção.' }
    }

    // 3. Teste de LEITURA PÓS-ESCRITA
    const { data: verifyData, error: verifyErr } = await supabase
      .from('shared_state')
      .select('updated_at')
      .eq('id', 1)
      .maybeSingle()

    if (verifyErr || !verifyData) {
      log('❌ VERIFICAÇÃO pós-escrita falhou')
      return { ok: false, error: 'Verificação pós-escrita falhou: ' + (verifyErr?.message || 'sem dados') }
    }

    if (new Date(verifyData.updated_at).getTime() !== new Date(testTs).getTime()) {
      log('❌ ESCRITA NÃO PERSISTIU! Gravou "' + testTs + '" mas leu "' + verifyData.updated_at + '"')
      return { ok: false, error: 'DADOS NÃO PERSISTEM no Supabase! Escreveu mas ao ler voltou diferente. Verifique triggers, policies e limites do plano.' }
    }

    log('✓ ESCRITA ok — dados persistem corretamente')
    return { ok: true, error: null, counts: counts(data.data) }
  } catch (e) {
    log('❌ EXCEÇÃO no teste: ' + (e?.message || e))
    return { ok: false, error: 'Exceção: ' + (e?.message || e) }
  }
}

// ─── LOAD ───
export async function loadState() {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('shared_state')
      .select('data, version')
      .eq('id', 1)
      .maybeSingle()
    if (error) { log('❌ loadState: ' + error.message); return null }
    if (!data) { log('❌ loadState: sem dados'); return null }
    const c = counts(data.data)
    log('📥 LOAD Supabase: v' + data.version + ' — ' + c.bk + 'bk ' + c.sh + 'sh ' + c.pd + 'pd ' + c.sl + 'sl')
    return { ...(data.data || {}), __version: data.version || 0 }
  } catch (e) { log('❌ loadState exceção: ' + (e?.message || e)); return null }
}

// ─── localStorage ───
export function loadLocalState() {
  try {
    const raw = localStorage.getItem('booking-control-data')
    const d = raw ? JSON.parse(raw) : null
    if (d) { const c = counts(d); log('📥 LOAD local: ' + c.bk + 'bk ' + c.sh + 'sh ' + c.pd + 'pd ' + c.sl + 'sl') }
    return d
  } catch { return null }
}

export function saveLocalState(state) {
  try { localStorage.setItem('booking-control-data', JSON.stringify(state)) }
  catch (e) { log('❌ saveLocal: ' + (e?.message || e)) }
}

// ─── SAVE com verificação ───
export async function saveState(state, userName) {
  if (!supabase) return { ok: false, reason: 'no-supabase' }

  const localCounts = counts(state)
  log('💾 SAVE iniciando — ' + localCounts.bk + 'bk ' + localCounts.sh + 'sh ' + localCounts.pd + 'pd ' + localCounts.sl + 'sl')

  const MAX = 5
  for (let i = 0; i < MAX; i++) {
    try {
      // 1. Lê
      const { data: cur, error: rErr } = await supabase
        .from('shared_state')
        .select('data, version')
        .eq('id', 1)
        .maybeSingle()

      if (rErr) { log('⚠ save read #' + (i+1) + ': ' + rErr.message); await delay(300*(i+1)); continue }

      const remoteData = cur?.data || null
      const remoteVer = cur?.version || 0
      const merged = mergeStates(remoteData, state)
      const newVer = remoteVer + 1
      const mc = counts(merged)

      // 2. Grava
      let writeOk = false
      if (remoteVer > 0) {
        const { data: res, error: wErr } = await supabase
          .from('shared_state')
          .update({ data: merged, version: newVer, updated_at: new Date().toISOString(), updated_by: userName || 'system' })
          .eq('id', 1)
          .eq('version', remoteVer)
          .select('version')
        if (wErr) { log('⚠ save write #' + (i+1) + ': ' + wErr.message); await delay(300*(i+1)); continue }
        writeOk = res && res.length > 0
        if (!writeOk) { log('⚠ save conflito versão #' + (i+1)); await delay(200*(i+1)); continue }
      } else {
        const { error: wErr } = await supabase
          .from('shared_state')
          .upsert({ id: 1, data: merged, version: newVer, updated_at: new Date().toISOString(), updated_by: userName || 'system' }, { onConflict: 'id' })
        if (wErr) { log('⚠ save upsert #' + (i+1) + ': ' + wErr.message); await delay(300*(i+1)); continue }
        writeOk = true
      }

      if (writeOk) {
        // 3. VERIFICAÇÃO: lê de volta e compara
        const { data: verify } = await supabase.from('shared_state').select('data, version').eq('id', 1).maybeSingle()
        if (verify) {
          const vc = counts(verify.data)
          const ok = vc.bk >= localCounts.bk && vc.sh >= localCounts.sh
          if (!ok) {
            log('🚨 VERIFY FALHOU! Salvou ' + mc.bk + 'bk mas leu de volta ' + vc.bk + 'bk. TENTANDO DE NOVO...')
            await delay(500)
            continue // tenta de novo
          }
          log('✅ SAVE OK v' + newVer + ' — verificado: ' + vc.bk + 'bk ' + vc.sh + 'sh ' + vc.pd + 'pd')
        } else {
          log('⚠ SAVE OK v' + newVer + ' mas verificação falhou (leitura)')
        }
        return { ok: true, version: newVer, data: merged }
      }
    } catch (e) {
      log('❌ save exceção #' + (i+1) + ': ' + (e?.message || e))
      if (i === MAX - 1) return { ok: false, reason: String(e?.message || e) }
      await delay(300 * (i + 1))
    }
  }
  log('❌ SAVE FALHOU após ' + MAX + ' tentativas')
  return { ok: false, reason: 'max-retries' }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── REALTIME ───
export function subscribeToChanges(callback) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('shared-state-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_state' }, (payload) => {
      if (payload.new?.data) {
        log('📡 REALTIME recebido v' + (payload.new.version||'?'))
        callback(payload.new.data, payload.new.version)
      }
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ─── BACKUPS ───
const BK_KEY = 'booking-control-backups'
export function pushLocalBackup(state) {
  try {
    const raw = localStorage.getItem(BK_KEY)
    const list = raw ? JSON.parse(raw) : []
    list.unshift({ at: Date.now(), bookings: (state.bookings||[]).length, pendencias: (state.pendencias||[]).length, ships: (state.ships||[]).length, state })
    localStorage.setItem(BK_KEY, JSON.stringify(list.slice(0, 10)))
  } catch (e) { console.warn('[backup]', e) }
}
export function listLocalBackups() { try { return JSON.parse(localStorage.getItem(BK_KEY)) || [] } catch { return [] } }
export function clearLocalBackups() { try { localStorage.removeItem(BK_KEY) } catch {} }
