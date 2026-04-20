import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && key) ? createClient(url, key) : null

// ─────────────────────────────────────────────────────────────
// MERGE HELPERS — evitar perda de dados em edições concorrentes
// ─────────────────────────────────────────────────────────────

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
    // Anti-ressurreição: versão deletada SEMPRE vence
    if (isDel(item) && !isDel(prev)) { map.set(item.id, item); return }
    if (isDel(prev) && !isDel(item)) return
    // Tie-break: mais recente vence
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
  const mergedBookings = mergeCollection(older.bookings || [], newer.bookings || [])
  return { ...newer, bookings: mergedBookings }
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

// ─── LOAD shared state ───
export async function loadState() {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('shared_state')
      .select('data, version')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return null
    return { ...(data.data || {}), __version: data.version || 0 }
  } catch (e) {
    console.warn('[loadState] exception:', e?.message || e)
    return null
  }
}

// ─── LOAD localStorage (rede de segurança) ───
export function loadLocalState() {
  try {
    const raw = localStorage.getItem('booking-control-data')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ─── SAVE LOCAL imediato ───
export function saveLocalState(state) {
  try {
    localStorage.setItem('booking-control-data', JSON.stringify(state))
  } catch (e) {
    console.warn('[saveLocalState] failed:', e?.message || e)
  }
}

// ─── SAVE — read-modify-write com LOCKING OTIMISTA e retry ───
export async function saveState(state, userName) {
  if (!supabase) return { ok: false, reason: 'no-supabase' }

  const MAX_RETRIES = 5
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { data: cur, error: readErr } = await supabase
        .from('shared_state')
        .select('data, version')
        .eq('id', 1)
        .maybeSingle()

      if (readErr) {
        console.warn('[saveState] read error:', readErr.message)
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
        continue
      }

      const remoteData    = cur?.data    || null
      const remoteVersion = cur?.version || 0
      const merged = mergeStates(remoteData, state)
      const newVersion = remoteVersion + 1

      if (remoteVersion > 0) {
        // UPDATE com locking otimista: WHERE version = versão lida
        const { data: result, error: writeErr } = await supabase
          .from('shared_state')
          .update({
            data: merged,
            version: newVersion,
            updated_at: new Date().toISOString(),
            updated_by: userName || 'system'
          })
          .eq('id', 1)
          .eq('version', remoteVersion)
          .select('version')

        if (writeErr) {
          console.warn(`[saveState] write error (try ${attempt + 1}):`, writeErr.message)
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
          continue
        }

        if (!result || result.length === 0) {
          console.log(`[saveState] version conflict (try ${attempt + 1}), re-reading...`)
          await new Promise(r => setTimeout(r, 150 * (attempt + 1)))
          continue
        }
      } else {
        const { error: writeErr } = await supabase
          .from('shared_state')
          .upsert({
            id: 1,
            data: merged,
            version: newVersion,
            updated_at: new Date().toISOString(),
            updated_by: userName || 'system'
          }, { onConflict: 'id' })

        if (writeErr) {
          console.warn(`[saveState] upsert error (try ${attempt + 1}):`, writeErr.message)
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
          continue
        }
      }

      return { ok: true, version: newVersion, data: merged }
    } catch (e) {
      console.warn(`[saveState] exception (try ${attempt + 1}):`, e?.message || e)
      if (attempt === MAX_RETRIES - 1) return { ok: false, reason: String(e?.message || e) }
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  return { ok: false, reason: 'max-retries' }
}

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

// ─────────────────────────────────────────────────────────────
// BACKUPS LOCAIS ROTATIVOS
// ─────────────────────────────────────────────────────────────
const BACKUP_KEY = 'booking-control-backups'
const MAX_BACKUPS = 10

export function pushLocalBackup(state) {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    const list = raw ? JSON.parse(raw) : []
    list.unshift({
      at: Date.now(),
      bookings:   (state.bookings   || []).length,
      pendencias: (state.pendencias || []).length,
      ships:      (state.ships      || []).length,
      state,
    })
    localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, MAX_BACKUPS)))
  } catch (e) {
    console.warn('[pushLocalBackup] failed:', e?.message || e)
  }
}

export function listLocalBackups() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function clearLocalBackups() {
  try { localStorage.removeItem(BACKUP_KEY) } catch {}
}
