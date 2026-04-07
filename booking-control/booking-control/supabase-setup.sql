-- ============================================================
-- BOOKING CONTROL — Script de criação do banco de dados
-- Execute este SQL inteiro no Supabase SQL Editor
-- Dashboard > SQL Editor > New query > Cole e Execute
-- ============================================================

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gerencia', 'operador')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE ARMADORES
CREATE TABLE IF NOT EXISTS armadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA PRINCIPAL DE BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  client TEXT NOT NULL,
  client_ref TEXT,
  subject TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  booking_number TEXT,
  equip_qty INTEGER NOT NULL DEFAULT 1,
  equip_type TEXT NOT NULL,
  pol TEXT NOT NULL,
  pod TEXT NOT NULL,
  armador TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Solicitado'
    CHECK (status IN ('Solicitado', 'Em análise', 'Aprovado', 'Recusado')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA DE HISTÓRICO DE STATUS
CREATE TABLE IF NOT EXISTS booking_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_created_by ON bookings(created_by);

-- 6. DADOS INICIAIS — ARMADORES
INSERT INTO armadores (name) VALUES
  ('MSC'), ('Maersk'), ('CMA CGM'), ('Hapag-Lloyd'),
  ('COSCO'), ('Evergreen'), ('ONE'), ('HMM'),
  ('Yang Ming'), ('ZIM')
ON CONFLICT (name) DO NOTHING;

-- 7. DADOS INICIAIS — USUÁRIO ADMIN
-- IMPORTANTE: Em produção, troque por hash bcrypt real
INSERT INTO users (username, password_hash, name, role) VALUES
  ('admin', 'admin123', 'Administrador', 'gerencia'),
  ('operador1', 'op123', 'Operador 1', 'operador'),
  ('operador2', 'op123', 'Operador 2', 'operador')
ON CONFLICT (username) DO NOTHING;

-- 8. ROW LEVEL SECURITY (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE armadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir leitura e escrita para chave anon
-- (Em produção, restrinja por autenticação Supabase Auth)
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on armadores" ON armadores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on booking_history" ON booking_history FOR ALL USING (true) WITH CHECK (true);

-- 9. HABILITAR REALTIME PARA BOOKINGS
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- ============================================================
-- PRONTO! Agora configure as variáveis no .env.local:
-- VITE_SUPABASE_URL = (Settings > API > Project URL)
-- VITE_SUPABASE_ANON_KEY = (Settings > API > anon public)
-- ============================================================
