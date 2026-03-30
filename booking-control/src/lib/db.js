import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && key) ? createClient(url, key) : null

// ─── LOAD shared state ───
export async function loadState() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('shared_state')
    .select('data')
    .eq('id', 1)
    .single()
  if (error || !data) return null
  return data.data
}

// ─── SAVE shared state ───
export async function saveState(state, userName) {
  if (!supabase) return
  const { error } = await supabase
    .from('shared_state')
    .upsert({
      id: 1,
      data: state,
      updated_at: new Date().toISOString(),
      updated_by: userName || 'system'
    })
  if (error) console.error('Save error:', error)
}

// ─── REALTIME subscription ───
export function subscribeToChanges(callback) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('shared-state-changes')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shared_state' }, (payload) => {
      if (payload.new?.data) callback(payload.new.data)
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}
