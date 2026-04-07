# CHANGELOG — Atualização de Abril/2026

## 🎯 O que mudou

### 1. Novo status: "Em processo de transferência" 🔄
- Adicionado ao fluxo de bookings (cor roxa, ícone 🔄).
- Aparece como opção de mudança de status e como filtro na aba **Bookings**.
- **Não conta para SLA** (mesmo tratamento de Aprovado / Enviado ao cliente).

### 2. Relatório de Bookings para WhatsApp 💬
- Novo botão **"💬 Relatório WhatsApp"** ao lado de "+ Novo Booking".
- Gera um texto formatado de todas as reservas ativas, agrupadas por status, com:
  cliente, referência, equipamento, rota (POL → POD), armador, nº booking, navio, data de saída, urgência.
- Ao clicar:
  1. O texto é **copiado automaticamente para a área de transferência** (fallback seguro para relatórios longos).
  2. Uma janela do WhatsApp Web é aberta (`wa.me`) para você escolher o contato e enviar.
- Cancelados não entram no relatório.

### 3. 🛡️ Segurança de Dados (fim do sumiço e duplicação)

Esta foi a mudança mais importante. O problema raiz era **arquitetural**:
todo o estado do sistema era salvo como um único blob JSON na tabela
`shared_state`, e qualquer `upsert` de um usuário **sobrescrevia por
completo** o que outro usuário tinha acabado de salvar (last-write-wins).

#### Correções aplicadas:

**a) Merge inteligente no servidor (`src/lib/db.js`)**
- `saveState()` agora faz **read-modify-write com merge**: lê o estado
  remoto atual, combina com o local item-por-item usando `updatedAt`
  como critério de desempate, e só então grava.
- 3 tentativas automáticas em caso de erro.
- Nenhum lançamento feito por outro operador é mais apagado pelo seu save.

**b) Merge no cliente, em vez de substituição**
- Antes: quando o realtime trazia um update, `applyState` fazia
  `setBookings(d.bookings)` — substituição direta que podia apagar
  alterações locais ainda não salvas.
- Agora: `applyState` faz merge por `id`, preservando ambos os lados.

**c) Fim do "echo de save"**
- Antes: receber um update remoto disparava o `useEffect` de save,
  re-gravando o estado recém-recebido (podendo ressuscitar itens deletados).
- Agora: flag `applyingRemoteRef` pula o save quando o estado veio do
  remoto.

**d) Fim da janela cega de 4 segundos**
- Antes: updates do Supabase Realtime eram **ignorados** por 4s após
  qualquer edição local, fazendo você nunca ver as alterações de
  colegas que salvassem nessa janela.
- Agora: updates remotos são sempre aplicados (o merge resolve os
  conflitos).

**e) Dedupe automático**
- Antes de cada gravação, listas são deduplicadas por `id` (mantendo o
  `updatedAt` mais recente). Isso elimina duplicatas que possam ter
  escapado de saves simultâneos.

**f) Optimistic locking (coluna `version`)**
- Nova coluna `version` em `shared_state` (ver
  `supabase-migration-v2.sql`). Cada save incrementa a versão, permitindo
  detectar conflitos e resolver via retry com merge.

**g) Backups locais rotativos + recuperação manual**
- O sistema agora guarda automaticamente os **10 snapshots mais
  recentes** no navegador de cada operador (localStorage).
- Novo botão **💾** no cabeçalho (apenas para gerência) abre a tela de
  **Recuperação de Backups**: lista os snapshots por data/hora com
  contagem de bookings/pendências/navios e permite restaurar com 1 clique.
- Ao restaurar, o estado atual é **também salvo como backup** antes —
  dá pra desfazer a restauração.
- Snapshots são criados: a cada save bem-sucedido, a cada 2 min de
  uso contínuo, e ao restaurar.

**h) Indicador visual de gravação no cabeçalho**
- Badge verde ✓ **"Salvo HH:MM"** quando tudo está sincronizado.
- Badge amarelo 💾 **"Salvando..."** durante o envio.
- Badge vermelho ⚠ **"Erro ao salvar"** se falhar — sinal para chamar
  o suporte antes de continuar digitando.

---

## 🚀 Como aplicar em produção

1. **Aplicar a migration SQL no Supabase:**
   - Supabase Dashboard → SQL Editor → New query
   - Cole o conteúdo de `supabase-migration-v2.sql` e rode.
   - Isso é **seguro e não-destrutivo** (só adiciona coluna `version`).

2. **Fazer o deploy do código atualizado** (mesmo processo de sempre:
   `npm run build` e publicar).

3. **Testar com 2 operadores simultâneos:**
   - Abra o sistema em duas abas diferentes com usuários diferentes.
   - Crie um booking em cada aba ao mesmo tempo.
   - **Antes da correção:** um dos dois sumia.
   - **Depois da correção:** ambos devem aparecer nas duas abas em
     segundos.

4. **Se alguém reportar dado faltando** depois do deploy:
   - Peça pra pessoa logar como gerência e clicar no botão **💾** no
     cabeçalho.
   - Escolha um snapshot anterior ao problema e clique em "Restaurar".

---

## 📋 Arquivos alterados

- `src/lib/db.js` — reescrito (merge, read-modify-write, backups).
- `src/App.jsx` — novo status, botão WhatsApp, nova lógica de save/apply,
  componente `BackupRecovery`, indicador de status.
- `supabase-migration-v2.sql` — **novo arquivo**, aplicar no Supabase.
