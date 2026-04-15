import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && key) ? createClient(url, key) : null

// ─────────────────────────────────────────────────────────────
// MERGE HELPERS — evitar perda de dados em edições concorrentes
// ─────────────────────────────────────────────────────────────
// Regras:
// 1) Cada item é identificado por `id`.
// 2) Em conflito, o `updatedAt` mais recente vence (fallback: createdAt).
// 3) Itens com `deletedAt` (tombstone) continuam na coleção — é a única
//    forma de a exclusão propagar entre clientes. A UI filtra ao exibir.
// 4) Itens com `_purged:true` (apagados permanentemente) também são
//    preservados como tombstones para não "ressuscitarem".
// 5) Para navios (ships), mesclamos também o array interno `bookings`
//    por id+updatedAt, para que edições simultâneas em sub-bookings de
//    clientes diferentes não sobrescrevam umas às outras.

function ts(item) {
  return (item && (item.updatedAt || item.createdAt)) || 0
}

function mergeCollection(remoteArr, localArr, itemMerger) {
  const map = new Map()
  const put = (item) => {
    if (!item || !item.id) return
    const prev = map.get(item.id)
    if (!prev) { map.set(item.id, item); return }
    if (itemMerger) { map.set(item.id, itemMerger(prev, item)); return }
    // Tie-break: mais recente vence; em empate, mantém o primeiro.
    if (ts(item) > ts(prev)) map.set(item.id, item)
  }
  ;(remoteArr || []).forEach(put)
  ;(localArr  || []).forEach(put)
  return Array.from(map.values())
}

// Merger específico para navios: escolhe o "esqueleto" do navio pelo
// updatedAt mais recente, mas mescla os sub-bookings por id (nunca perde).
function mergeShip(a, b) {
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
    solicitacoes:mergeCollection(remote.solicitacoes,local.solicitacoes),
    users:      (local.users     && local.users.length)     ? local.users     : remote.users,
    armadores:  (local.armadores && local.armadores.length) ? local.armadores : remote.armadores,
    logo:       local.logo !== undefined ? local.logo : remote.logo,
  }
}

// ─── LOAD shared state ───
export async function loadState() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('shared_state')
    .select('data, version')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  return { ...(data.data || {}), __version: data.version || 0 }
}

// ─── SAVE — read-modify-write com merge e retry ───
export async function saveState(state, userName) {
  if (!supabase) return { ok: false, reason: 'no-supabase' }

  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const { data: cur, error: readErr } = await supabase
        .from('shared_state')
        .select('data, version')
        .eq('id', 1)
        .maybeSingle()

      if (readErr) console.warn('[saveState] read error:', readErr.message)

      const remoteData    = cur?.data    || null
      const remoteVersion = cur?.version || 0

      const merged = mergeStates(remoteData, state)

      const payload = {
        id: 1,
        data: merged,
        version: remoteVersion + 1,
        updated_at: new Date().toISOString(),
        updated_by: userName || 'system'
      }

      const { error: writeErr } = await supabase
        .from('shared_state')
        .upsert(payload, { onConflict: 'id' })

      if (writeErr) {
        console.warn(`[saveState] write error (try ${attempt + 1}):`, writeErr.message)
        if (attempt === MAX_RETRIES - 1) return { ok: false, reason: writeErr.message }
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
        continue
      }

      return { ok: true, version: remoteVersion + 1, data: merged }
    } catch (e) {
      console.warn(`[saveState] exception (try ${attempt + 1}):`, e?.message || e)
      if (attempt === MAX_RETRIES - 1) return { ok: false, reason: String(e?.message || e) }
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
    }
  }
  return { ok: false, reason: 'max-retries' }
}

// ─── REALTIME subscription ───
export function subscribeToChanges(callback) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('shared-state-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shared_state' }, (payload) => {
      if (payload.new?.data) callback(payload.new.data, payload.new.version)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// ─────────────────────────────────────────────────────────────
// BACKUPS LOCAIS ROTATIVOS — rede de segurança contra perda
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
