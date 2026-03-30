# 📦 Booking Control — Gestão Estratégica de Solicitações

Dashboard completo para controle de solicitações de booking com SLA de 2 horas, escalonamento automático para gerência e gestão de usuários.

## 🚀 Deploy Rápido (3 passos)

### Passo 1 — Supabase (banco de dados)

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Clique em **New Project** → escolha região São Paulo (`sa-east-1`)
3. No painel, vá em **SQL Editor** → cole e execute todo o conteúdo do arquivo `supabase-setup.sql`
4. Vá em **Settings → API** e copie:
   - **Project URL** (ex: `https://abc123.supabase.co`)
   - **anon public key**

### Passo 2 — GitHub (repositório)

```bash
# Clone ou copie esta pasta para seu computador, depois:
cd booking-control
git init
git add .
git commit -m "feat: booking control v1"
gh repo create booking-control --public --push
```

### Passo 3 — Vercel (deploy)

1. Acesse [vercel.com](https://vercel.com) → login com GitHub
2. **Add New Project** → importe `booking-control`
3. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` → sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → sua chave anon
4. Clique em **Deploy** → pronto!

---

## 🧑‍💻 Desenvolvimento Local

```bash
npm install
```

Crie o arquivo `.env.local` na raiz:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

```bash
npm run dev
```

Acesse `http://localhost:5173`

---

## 📁 Estrutura do Projeto

```
booking-control/
├── public/favicon.svg
├── src/
│   ├── components/
│   │   ├── LoginScreen.jsx      # Tela de login
│   │   ├── Dashboard.jsx        # Painel principal + tabela
│   │   ├── NewRequestModal.jsx  # Modal de nova solicitação
│   │   ├── DetailModal.jsx      # Detalhe + edição do pedido
│   │   ├── UserManager.jsx      # CRUD de usuários
│   │   └── ArmadorManager.jsx   # Gestão de armadores
│   ├── lib/
│   │   ├── supabase.js          # Cliente Supabase + todas queries
│   │   └── constants.js         # Status, helpers, estilos
│   ├── App.jsx                  # Orquestrador principal
│   ├── main.jsx                 # Entry point React
│   └── index.css                # Estilos globais + animações
├── supabase-setup.sql           # SQL para criar tabelas
├── package.json
├── vite.config.js
├── .env.local                   # Suas credenciais (NÃO commitar)
├── .gitignore
└── README.md
```

---

## 🔐 Credenciais Padrão

| Perfil    | Login      | Senha    |
|-----------|------------|----------|
| Gerência  | admin      | admin123 |
| Operador  | operador1  | op123    |
| Operador  | operador2  | op123    |

> ⚠️ Troque as senhas após o primeiro acesso!

---

## ✨ Funcionalidades

- **Login com perfis** — Gerência e Operador com permissões diferentes
- **CRUD de Usuários** — Cadastrar, editar e excluir (só gerência)
- **SLA de 2 horas** — Timer regressivo em tempo real por pedido
- **Escalonamento visual** — Pedidos > 2h ficam vermelhos com glow pulsante
- **Urgentes** — Pedidos com < 30min restantes ficam em alerta laranja
- **Campos completos** — Cliente, referência, assunto, e-mail, booking, equipamento, POL/POD, armador
- **Edição inline** — POL, POD, booking number, equipamento e armador editáveis
- **Gestão de armadores** — Adicionar/remover armadores do sistema
- **Realtime** — Atualizações automáticas entre usuários via Supabase Realtime
