import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && key) ? createClient(url, key) : null

// ─── MERGE HELPERS ───

function ts(item) {
  return (item && (item.updatedAt || item.createdAt)) || 0
}

function isDel(item) {
  return !!(item && (item._purged || item.deletedAt || item._deleted))
}

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
  if (!local)  return remote
  return {
    bookings:    mergeCollection(remote.bookings,    local.bookings),
    pendencias:  mergeCollection(remote.pendencias,  local.pendencias),
    ships:       mergeCollection(remote.ships,       local.ships, mergeShip),
    solicitacoes:mergeCollection(remote.solicitacoes, local.solicitacoes),
    users:      (local.users     && local.users.length)     ? local.users     : remote.users,
    armadores:  (local.armadores && local.armadores.length) ? local.armadores : remote.armadores,
    logo:       local.logo !== undefined ? local.logo : remote.logo,
  }
}

// ─── TESTE DE CONEXÃO ───
// Verifica se a tabela shared_state existe e está acessível.
// Retorna { ok: bool, error: string|null }
export async function testConnection() {
  if (!supabase) return { ok: false, error: 'Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)' }
  try {
    const { data, error } = await supabase
      .from('shared_state')
      .select('id, version')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return { ok: false, error: 'Tabela shared_state NÃO EXISTE no Supabase. Execute o SQL de correção.' }
      }
      if (error.code === '42501' || error.message.includes('permission')) {
        return { ok: false, error: 'Sem permissão para acessar shared_state. Verifique as policies RLS.' }
      }
      return { ok: false, error: `Erro ao ler Supabase: ${error.message}` }
    }
    if (!data) {
      return { ok: false, error: 'Tabela shared_state existe mas está vazia. Execute o SQL de correção.' }
    }
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: `Exceção: ${e?.message || e}` }
  }
}

// ─── LOAD shared state ───
export async function loadState() {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('shared_state')
      .select('data, version')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      console.error('[loadState] ERRO:', error.message)
      return null
    }
    if (!data) return null
    return { ...(data.data || {}), __version: data.version || 0 }
  } catch (e) {
    console.error('[loadState] EXCEÇÃO:', e?.message || e)
    return null
  }
}

// ─── localStorage helpers ───
export function loadLocalState() {
  try {
    const raw = localStorage.getItem('booking-control-data')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveLocalState(state) {
  try {
    localStorage.setItem('booking-control-data', JSON.stringify(state))
  } catch (e) {
    console.warn('[saveLocalState]', e?.message || e)
  }
}

// ─── SAVE com merge + retry + verificação ───
export async function saveState(state, userName) {
  if (!supabase) return { ok: false, reason: 'no-supabase' }

  const MAX = 5
  for (let i = 0; i < MAX; i++) {
    try {
      // 1. Lê estado atual
      const { data: cur, error: rErr } = await supabase
        .from('shared_state')
        .select('data, version')
        .eq('id', 1)
        .maybeSingle()

      if (rErr) {
        console.warn(`[save] read error #${i + 1}:`, rErr.message)
        await delay(300 * (i + 1))
        continue
      }

      const remoteData = cur?.data || null
      const remoteVer  = cur?.version || 0
      const merged     = mergeStates(remoteData, state)
      const newVer     = remoteVer + 1
      const now        = new Date().toISOString()

      // 2. Grava
      let writeOk = false
      if (remoteVer > 0) {
        // UPDATE com locking otimista
        const { data: res, error: wErr } = await supabase
          .from('shared_state')
          .update({ data: merged, version: newVer, updated_at: now, updated_by: userName || 'system' })
          .eq('id', 1)
          .eq('version', remoteVer)
          .select('version')
        if (wErr) {
          console.warn(`[save] write error #${i + 1}:`, wErr.message)
          await delay(300 * (i + 1))
          continue
        }
        writeOk = res && res.length > 0
        if (!writeOk) {
          // Conflito de versão — outro cliente gravou primeiro → retry
          console.log(`[save] version conflict #${i + 1}, retrying...`)
          await delay(200 * (i + 1))
          continue
        }
      } else {
        // Upsert (primeiro save)
        const { error: wErr } = await supabase
          .from('shared_state')
          .upsert({ id: 1, data: merged, version: newVer, updated_at: now, updated_by: userName || 'system' }, { onConflict: 'id' })
        if (wErr) {
          console.warn(`[save] upsert error #${i + 1}:`, wErr.message)
          await delay(300 * (i + 1))
          continue
        }
        writeOk = true
      }

      if (writeOk) {
        // 3. VERIFICAÇÃO: lê de volta para confirmar que os dados estão lá
        const { data: verify, error: vErr } = await supabase
          .from('shared_state')
          .select('version')
          .eq('id', 1)
          .maybeSingle()
        
        if (vErr || !verify) {
          console.warn(`[save] verify failed #${i + 1}:`, vErr?.message)
          // Gravou mas não conseguiu confirmar — trata como sucesso parcial
        }

        return { ok: true, version: newVer, data: merged }
      }
    } catch (e) {
      console.warn(`[save] exception #${i + 1}:`, e?.message || e)
      if (i === MAX - 1) return { ok: false, reason: String(e?.message || e) }
      await delay(300 * (i + 1))
    }
  }
  return { ok: false, reason: 'max-retries' }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── REALTIME subscription ───
export function subscribeToChanges(callback) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('shared-state-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_state' }, (payload) => {
      if (payload.new?.data) callback(payload.new.data, payload.new.version)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ─── BACKUPS LOCAIS ───
const BK_KEY = 'booking-control-backups'
const BK_MAX = 10

export function pushLocalBackup(state) {
  try {
    const raw = localStorage.getItem(BK_KEY)
    const list = raw ? JSON.parse(raw) : []
    list.unshift({
      at: Date.now(),
      bookings:   (state.bookings   || []).length,
      pendencias: (state.pendencias || []).length,
      ships:      (state.ships      || []).length,
      state,
    })
    localStorage.setItem(BK_KEY, JSON.stringify(list.slice(0, BK_MAX)))
  } catch (e) {
    console.warn('[backup]', e?.message || e)
  }
}

export function listLocalBackups() {
  try {
    const raw = localStorage.getItem(BK_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function clearLocalBackups() {
  try { localStorage.removeItem(BK_KEY) } catch {}
}
