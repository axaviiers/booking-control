import { useState, useMemo } from "react";

/* ═══════════════════════════════════════════════
   DADOS DE EXEMPLO — simulando o que já existe no sistema
   ═══════════════════════════════════════════════ */
const SAMPLE_COTACOES = [
  {
    id: "COT-001",
    pol: "Santos", pod: "Algiers",
    cliente: "AMENCO AGROINDUSTRIAL LTDA",
    armador: "MSC - SSZ",
    tipo: "FCL - 40' HC",
    ftOrigem: 14, ftDestino: 14,
    validade: "Maio/2026",
    itens: [
      { nome: "Frete", moeda: "USD", valor: 2190 },
      { nome: "FOODGRADE", moeda: "USD", valor: 150 },
      { nome: "PILOTAGE SERVICE COST", moeda: "USD", valor: 36 },
      { nome: "EU ETS SURCHARGE", moeda: "USD", valor: 148 },
      { nome: "FUEL EU SURCHARGE", moeda: "USD", valor: 30 },
      { nome: "CSF", moeda: "USD", valor: 11 },
      { nome: "CDD - POR BL", moeda: "USD", valor: 25 },
      { nome: "EMERGENCY FUEL SURCHARGE", moeda: "USD", valor: 236 },
      { nome: "BL", moeda: "BRL", valor: 640 },
      { nome: "LACRE", moeda: "BRL", valor: 75 },
      { nome: "ISPS", moeda: "BRL", valor: 125 },
      { nome: "EQUIPMENT CONTROL FEE", moeda: "BRL", valor: 205 },
      { nome: "THC", moeda: "BRL", valor: 1660 },
    ],
    totalUSD: 2826, totalBRL: 2705,
  },
  {
    id: "COT-002",
    pol: "Santos", pod: "Valencia",
    cliente: "AMENCO AGROINDUSTRIAL LTDA",
    armador: "MSC - SSZ",
    tipo: "FCL - 40' HC",
    ftOrigem: 14, ftDestino: 14,
    validade: "Maio/2026",
    itens: [
      { nome: "Frete", moeda: "USD", valor: 800 },
      { nome: "FOODGRADE", moeda: "USD", valor: 150 },
      { nome: "PILOTAGE SERVICE COST", moeda: "USD", valor: 36 },
      { nome: "EU ETS SURCHARGE", moeda: "USD", valor: 148 },
      { nome: "FUEL EU SURCHARGE", moeda: "USD", valor: 30 },
      { nome: "CSF", moeda: "USD", valor: 11 },
      { nome: "CDD - POR BL", moeda: "USD", valor: 25 },
      { nome: "EMERGENCY FUEL SURCHARGE", moeda: "USD", valor: 236 },
      { nome: "BL", moeda: "BRL", valor: 640 },
      { nome: "LACRE", moeda: "BRL", valor: 75 },
      { nome: "ISPS", moeda: "BRL", valor: 125 },
      { nome: "EQUIPMENT CONTROL FEE", moeda: "BRL", valor: 205 },
      { nome: "THC", moeda: "BRL", valor: 1660 },
    ],
    totalUSD: 1436, totalBRL: 2705,
  },
  {
    id: "COT-003",
    pol: "Santos", pod: "Hamburg",
    cliente: "AMENCO AGROINDUSTRIAL LTDA",
    armador: "Hapag-Lloyd",
    tipo: "FCL - 40' HC",
    ftOrigem: 14, ftDestino: 14,
    validade: "Maio/2026",
    itens: [
      { nome: "Frete", moeda: "USD", valor: 1650 },
      { nome: "FOODGRADE", moeda: "USD", valor: 150 },
      { nome: "THD", moeda: "USD", valor: 215 },
      { nome: "EU ETS SURCHARGE", moeda: "USD", valor: 148 },
      { nome: "FUEL EU SURCHARGE", moeda: "USD", valor: 30 },
      { nome: "CSF", moeda: "USD", valor: 11 },
      { nome: "CDD - POR BL", moeda: "USD", valor: 25 },
      { nome: "EMERGENCY FUEL SURCHARGE", moeda: "USD", valor: 195 },
      { nome: "BL", moeda: "BRL", valor: 640 },
      { nome: "LACRE", moeda: "BRL", valor: 75 },
      { nome: "ISPS", moeda: "BRL", valor: 125 },
      { nome: "EQUIPMENT CONTROL FEE", moeda: "BRL", valor: 205 },
      { nome: "THC", moeda: "BRL", valor: 1660 },
    ],
    totalUSD: 2424, totalBRL: 2705,
  },
];

const SAMPLE_NAVIOS = [
  // Algiers
  { id: "NV-01", armador: "MSC - SSZ", navio: "COPIAPO", pol: "Santos", pod: "Algiers", transitDays: 35, via: "BARCELONA", eta: "05/06/2026", etd: "01/05/2026", dlDraft: "23/04/2026 16:00", dlCarga: "28/04/2026 12:00" },
  { id: "NV-02", armador: "MSC - SSZ", navio: "MSC CATERINA", pol: "Santos", pod: "Algiers", transitDays: 35, via: "BARCELONA", eta: "12/06/2026", etd: "08/05/2026", dlDraft: "30/04/2026 16:00", dlCarga: "04/05/2026 12:00" },
  { id: "NV-03", armador: "MSC - SSZ", navio: "MSC LE HAVRE", pol: "Santos", pod: "Algiers", transitDays: 35, via: "BARCELONA", eta: "18/06/2026", etd: "14/05/2026", dlDraft: "07/05/2026 16:00", dlCarga: "11/05/2026 12:00" },
  { id: "NV-04", armador: "MSC - SSZ", navio: "MSC MELINE", pol: "Santos", pod: "Algiers", transitDays: 35, via: "BARCELONA", eta: "25/06/2026", etd: "21/05/2026", dlDraft: "14/05/2026 16:00", dlCarga: "18/05/2026 18:00" },
  { id: "NV-05", armador: "MSC - SSZ", navio: "MSC ALBANY", pol: "Santos", pod: "Algiers", transitDays: 30, via: "Valencia", eta: "27/06/2026", etd: "28/05/2026", dlDraft: "21/05/2026 16:00", dlCarga: "25/05/2026 18:00" },
  // Valencia
  { id: "NV-06", armador: "MSC - SSZ", navio: "MSC CATERINA", pol: "Santos", pod: "Valencia", transitDays: 22, via: "BARCELONA", eta: "30/05/2026", etd: "08/05/2026", dlDraft: "30/04/2026 16:00", dlCarga: "04/05/2026 12:00" },
  { id: "NV-07", armador: "MSC - SSZ", navio: "MSC LE HAVRE", pol: "Santos", pod: "Valencia", transitDays: 22, via: "BARCELONA", eta: "05/06/2026", etd: "14/05/2026", dlDraft: "07/05/2026 16:00", dlCarga: "11/05/2026 12:00" },
  { id: "NV-08", armador: "MSC - SSZ", navio: "MSC ALBANY", pol: "Santos", pod: "Valencia", transitDays: 18, via: "DIRETO", eta: "15/06/2026", etd: "28/05/2026", dlDraft: "21/05/2026 16:00", dlCarga: "25/05/2026 18:00" },
  // Hamburg
  { id: "NV-09", armador: "Hapag-Lloyd", navio: "HAMBURG EXPRESS", pol: "Santos", pod: "Hamburg", transitDays: 24, via: "DIRETO", eta: "01/06/2026", etd: "08/05/2026", dlDraft: "01/05/2026 16:00", dlCarga: "04/05/2026 12:00" },
  { id: "NV-10", armador: "Hapag-Lloyd", navio: "SANTOS EXPRESS", pol: "Santos", pod: "Hamburg", transitDays: 24, via: "DIRETO", eta: "08/06/2026", etd: "15/05/2026", dlDraft: "08/05/2026 16:00", dlCarga: "11/05/2026 12:00" },
];

const fmtMoney = (v, moeda) => {
  if (v === null || v === undefined) return "—";
  const prefix = moeda === "BRL" ? "R$" : "$";
  return `${prefix} ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const routeKey = (pol, pod) => `${(pol || "").trim().toUpperCase()}→${(pod || "").trim().toUpperCase()}`;

const ARMADOR_COLORS = {
  "MSC - SSZ": "#1746A2", "MSC": "#1746A2", "Maersk": "#0F766E", "CMA CGM": "#C2590A",
  "Hapag-Lloyd": "#D42A1E", "COSCO": "#7C3AED", "Evergreen": "#047857", "ONE": "#BE185D",
  "HMM": "#0369A1", "Yang Ming": "#A16207", "ZIM": "#6D28D9",
};
const armC = (a) => ARMADOR_COLORS[a] || "#475569";

export default function PropostaMultiDestino() {
  const [selCot, setSelCot] = useState({});
  const [selNav, setSelNav] = useState({});
  const [view, setView] = useState("select");

  const cotacoes = SAMPLE_COTACOES;
  const navios = SAMPLE_NAVIOS;

  // Group cotações by route
  const cotByRoute = useMemo(() => {
    const m = {};
    cotacoes.forEach(c => {
      const k = routeKey(c.pol, c.pod);
      if (!m[k]) m[k] = { pol: c.pol, pod: c.pod, cotacoes: [], navios: [] };
      m[k].cotacoes.push(c);
    });
    navios.forEach(n => {
      const k = routeKey(n.pol, n.pod);
      if (!m[k]) m[k] = { pol: n.pol, pod: n.pod, cotacoes: [], navios: [] };
      m[k].navios.push(n);
    });
    return m;
  }, [cotacoes, navios]);

  const selCotIds = Object.keys(selCot).filter(k => selCot[k]);
  const selNavIds = Object.keys(selNav).filter(k => selNav[k]);

  // Selected data grouped by route
  const selectedRoutes = useMemo(() => {
    const m = {};
    cotacoes.filter(c => selCot[c.id]).forEach(c => {
      const k = routeKey(c.pol, c.pod);
      if (!m[k]) m[k] = { pol: c.pol, pod: c.pod, cotacoes: [], navios: [] };
      m[k].cotacoes.push(c);
    });
    navios.filter(n => selNav[n.id]).forEach(n => {
      const k = routeKey(n.pol, n.pod);
      if (!m[k]) m[k] = { pol: n.pol, pod: n.pod, cotacoes: [], navios: [] };
      m[k].navios.push(n);
    });
    return m;
  }, [selCot, selNav, cotacoes, navios]);

  const toggleCot = (id) => setSelCot(p => ({ ...p, [id]: !p[id] }));
  const toggleNav = (id) => setSelNav(p => ({ ...p, [id]: !p[id] }));
  const toggleAllRoute = (rk) => {
    const r = cotByRoute[rk]; if (!r) return;
    const allCotSel = r.cotacoes.every(c => selCot[c.id]);
    const allNavSel = r.navios.every(n => selNav[n.id]);
    const allSel = allCotSel && allNavSel;
    const cp = {}, np = {};
    r.cotacoes.forEach(c => { cp[c.id] = !allSel });
    r.navios.forEach(n => { np[n.id] = !allSel });
    setSelCot(p => ({ ...p, ...cp }));
    setSelNav(p => ({ ...p, ...np }));
  };

  const routeKeys = Object.keys(selectedRoutes);
  const canPreview = selCotIds.length > 0;

  // ═══════════ SELEÇÃO ═══════════
  if (view === "select") return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#F1F3F7", minHeight: "100vh", color: "#1a1f36" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        ::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-thumb { background: #c5cad4; border-radius: 4px }
      `}</style>

      {/* Top bar */}
      <div style={{ background: "#0C2340", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: 1.1, letterSpacing: ".5px", textAlign: "center" }}>INTER<br />SHIP</div>
          <div>
            <h1 style={{ color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: "-.2px" }}>Proposta Multi-Destino</h1>
            <p style={{ color: "rgba(255,255,255,.4)", fontSize: 11, fontWeight: 400 }}>Selecione cotações e navios para compor a proposta</p>
          </div>
        </div>
        <button onClick={() => canPreview && setView("preview")} style={{
          padding: "10px 24px", borderRadius: 8, border: "none",
          background: canPreview ? "#3B82F6" : "#334155", color: "#fff",
          fontSize: 13, fontWeight: 600, cursor: canPreview ? "pointer" : "default",
          fontFamily: "inherit", opacity: canPreview ? 1 : .5, transition: "all .2s"
        }}>
          Gerar Proposta →
        </button>
      </div>

      {/* Counters */}
      <div style={{ maxWidth: 1000, margin: "20px auto", padding: "0 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { n: selCotIds.length, l: `Cotação${selCotIds.length !== 1 ? "ões" : ""}`, c: "#3B82F6", bg: "#EFF6FF", bd: "#BFDBFE" },
            { n: selNavIds.length, l: `Navio${selNavIds.length !== 1 ? "s" : ""}`, c: "#0F766E", bg: "#F0FDFA", bd: "#99F6E4" },
            { n: Object.keys(cotByRoute).length, l: "Rotas disponíveis", c: "#7C3AED", bg: "#F5F3FF", bd: "#DDD6FE" },
          ].map((x, i) => (
            <div key={i} style={{ padding: "12px 16px", borderRadius: 10, background: x.bg, border: `1px solid ${x.bd}`, textAlign: "center" }}>
              <p style={{ fontSize: 24, fontWeight: 800, color: x.c }}>{x.n}</p>
              <p style={{ fontSize: 9, fontWeight: 600, color: x.c, textTransform: "uppercase", letterSpacing: ".5px" }}>{x.l}</p>
            </div>
          ))}
        </div>

        {/* Routes */}
        {Object.entries(cotByRoute).map(([rk, route]) => {
          const allCotSel = route.cotacoes.every(c => selCot[c.id]);
          const allNavSel = route.navios.every(n => selNav[n.id]);
          const someSel = route.cotacoes.some(c => selCot[c.id]) || route.navios.some(n => selNav[n.id]);

          return (
            <div key={rk} style={{ marginBottom: 16, borderRadius: 12, border: `1px solid ${someSel ? "#93C5FD" : "#DEE1E8"}`, background: "#fff", overflow: "hidden", animation: "fadeUp .3s ease" }}>
              {/* Route header */}
              <div onClick={() => toggleAllRoute(rk)} style={{
                padding: "12px 16px", background: someSel ? "#EFF6FF" : "#FAFBFC",
                borderBottom: "1px solid #E8EBF0", display: "flex", justifyContent: "space-between",
                alignItems: "center", cursor: "pointer"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={allCotSel && allNavSel} readOnly style={{ width: 16, height: 16, accentColor: "#3B82F6" }} />
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{route.pol}</span>
                  <span style={{ color: "#94A3B8", fontSize: 14, fontWeight: 300 }}>→</span>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{route.pod}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ padding: "3px 10px", borderRadius: 6, background: "#EFF6FF", color: "#3B82F6", fontSize: 10, fontWeight: 600 }}>{route.cotacoes.length} cotação</span>
                  <span style={{ padding: "3px 10px", borderRadius: 6, background: "#F0FDFA", color: "#0F766E", fontSize: 10, fontWeight: 600 }}>{route.navios.length} navios</span>
                </div>
              </div>

              {/* Cotações */}
              <div style={{ padding: "10px 16px" }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Cotações</p>
                {route.cotacoes.map(c => (
                  <div key={c.id} onClick={() => toggleCot(c.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8,
                    marginBottom: 4, background: selCot[c.id] ? "#EFF6FF" : "transparent",
                    border: `1px solid ${selCot[c.id] ? "#BFDBFE" : "transparent"}`, cursor: "pointer", transition: "all .15s"
                  }}>
                    <input type="checkbox" checked={!!selCot[c.id]} readOnly style={{ width: 14, height: 14, accentColor: "#3B82F6" }} />
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: armC(c.armador) }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: armC(c.armador) }}>{c.armador}</span>
                    <span style={{ fontSize: 12, color: "#64748B" }}>{c.tipo}</span>
                    <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#1a1f36" }}>{fmtMoney(c.totalUSD, "USD")}</span>
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>+ {fmtMoney(c.totalBRL, "BRL")}</span>
                  </div>
                ))}

                {/* Navios */}
                <p style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6, marginTop: 12 }}>Schedule de Navios</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {route.navios.map(n => (
                    <div key={n.id} onClick={() => toggleNav(n.id)} style={{
                      padding: "8px 10px", borderRadius: 8,
                      background: selNav[n.id] ? "#F0FDFA" : "#FAFBFC",
                      border: `1px solid ${selNav[n.id] ? "#99F6E4" : "#E8EBF0"}`,
                      cursor: "pointer", transition: "all .15s"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <input type="checkbox" checked={!!selNav[n.id]} readOnly style={{ width: 13, height: 13, accentColor: "#0F766E" }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#1a1f36" }}>{n.navio}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748B" }}>
                        <span>ETD: {n.etd}</span>
                        <span style={{ fontWeight: 600, color: "#0F766E" }}>{n.transitDays}d</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ═══════════ PREVIEW / PROPOSTA ═══════════
  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#fff", minHeight: "100vh", color: "#1a1f36" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        ::-webkit-scrollbar { width: 4px } ::-webkit-scrollbar-thumb { background: #c5cad4; border-radius: 4px }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ background: "#0C2340", padding: "10px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => setView("select")} style={{
          padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,.15)",
          background: "transparent", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit"
        }}>← Voltar</button>
        <button onClick={() => window.print()} style={{
          padding: "8px 20px", borderRadius: 8, border: "none",
          background: "#22C55E", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit"
        }}>🖨 Gerar PDF / Imprimir</button>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 24px" }}>

        {/* Cabeçalho da proposta */}
        <div style={{ marginBottom: 32, animation: "fadeUp .3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12, background: "#0C2340",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1.1, letterSpacing: ".5px", textAlign: "center"
              }}>INTER<br />SHIP</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0C2340", letterSpacing: "-.4px" }}>PROPOSTA COMERCIAL</h1>
                <p style={{ fontSize: 12, color: "#8891A5", fontWeight: 400 }}>Inter Shipping Ltda.</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#8891A5" }}>Data: {new Date().toLocaleDateString("pt-BR")}</p>
              <p style={{ fontSize: 11, color: "#8891A5", marginTop: 2 }}>
                {routeKeys.length} destino{routeKeys.length !== 1 ? "s" : ""} · {selNavIds.length} navio{selNavIds.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div style={{ height: 3, background: "linear-gradient(90deg, #0C2340, #3B82F6, transparent)", borderRadius: 2 }} />
        </div>

        {/* Cada rota */}
        {routeKeys.map((rk, ri) => {
          const route = selectedRoutes[rk];
          return (
            <div key={rk} style={{ marginBottom: 36, animation: `fadeUp .3s ease ${ri * 0.1}s both`, pageBreakInside: "avoid" }}>
              {/* ── DESTINO HEADER ── */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
                padding: "12px 18px", borderRadius: 10,
                background: "#0C2340", color: "#fff"
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, opacity: .4 }}>{String(ri + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.2px" }}>{route.pol}</span>
                <svg width="22" height="10" viewBox="0 0 22 10"><path d="M0 5h18m0 0l-4-4m4 4l-4 4" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.2px" }}>{route.pod}</span>
              </div>

              {/* ── COTAÇÕES DESTA ROTA ── */}
              {route.cotacoes.map(cot => (
                <div key={cot.id} style={{ marginBottom: 16, borderRadius: 10, border: "1px solid #E2E6EC", overflow: "hidden" }}>
                  {/* Detalhes */}
                  <div style={{ padding: "12px 18px", background: "#FAFBFC", borderBottom: "1px solid #E2E6EC" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#8891A5", textTransform: "uppercase", letterSpacing: ".5px" }}>Detalhes</span>
                      <span style={{
                        padding: "3px 12px", borderRadius: 6,
                        background: `${armC(cot.armador)}10`, color: armC(cot.armador),
                        fontSize: 10, fontWeight: 700
                      }}>FT: Origem {cot.ftOrigem} dias | Destino {cot.ftDestino} dias</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 9, color: "#8891A5", textTransform: "uppercase", fontWeight: 600 }}>Cliente</p>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{cot.cliente}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 9, color: "#8891A5", textTransform: "uppercase", fontWeight: 600 }}>Armador</p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: armC(cot.armador) }}>{cot.armador}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 9, color: "#8891A5", textTransform: "uppercase", fontWeight: 600 }}>Tipo</p>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{cot.tipo}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de valores */}
                  <div style={{ padding: "0 18px" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#8891A5", textTransform: "uppercase", letterSpacing: ".5px", padding: "10px 0 6px" }}>Valores</p>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {cot.itens.map((item, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #F1F3F6" }}>
                            <td style={{ padding: "6px 0", fontSize: 12, color: "#3a4055", fontWeight: 400 }}>{item.nome}</td>
                            <td style={{ padding: "6px 0", fontSize: 11, color: "#8891A5", textAlign: "right", width: 50, fontWeight: 500 }}>{item.moeda === "BRL" ? "R$" : "USD"}</td>
                            <td style={{ padding: "6px 0", fontSize: 12, textAlign: "right", width: 100, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                              {Number(item.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totais */}
                  <div style={{
                    margin: "10px 18px 14px", padding: "12px 16px", borderRadius: 8,
                    background: "#0C2340", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, opacity: .5, textTransform: "uppercase" }}>TOTAL USD</span>
                      <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.3px" }}>{fmtMoney(cot.totalUSD, "USD")}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, opacity: .5, textTransform: "uppercase" }}>TOTAL BRL</span>
                      <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.3px" }}>{fmtMoney(cot.totalBRL, "BRL")}</p>
                    </div>
                  </div>

                  {/* Validade */}
                  <div style={{ padding: "0 18px 12px", textAlign: "center" }}>
                    <span style={{
                      display: "inline-block", padding: "4px 20px", borderRadius: 6,
                      background: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 600
                    }}>Validade: {cot.validade}</span>
                  </div>
                </div>
              ))}

              {/* ── SCHEDULE DE NAVIOS ── */}
              {route.navios.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#8891A5", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8, paddingLeft: 2 }}>
                    Schedule — {route.navios.length} opç{route.navios.length !== 1 ? "ões" : "ão"} de navio
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {route.navios.map(n => (
                      <div key={n.id} style={{
                        padding: "12px 14px", borderRadius: 10, border: "1px solid #E2E6EC",
                        background: "#FAFBFC", pageBreakInside: "avoid"
                      }}>
                        {/* Ship identity */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: 3, background: armC(n.armador) }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: armC(n.armador) }}>{n.armador}</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1f36", marginBottom: 8, letterSpacing: "-.2px" }}>{n.navio}</p>

                        {/* Route visual */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#3a4055" }}>{n.pol}</span>
                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
                            <div style={{ flex: 1, height: 1, background: "#CBD5E1", borderTop: "1px dashed #CBD5E1" }} />
                            <span style={{
                              padding: "1px 6px", borderRadius: 4, background: "#3B82F6",
                              color: "#fff", fontSize: 9, fontWeight: 700, whiteSpace: "nowrap"
                            }}>{n.transitDays}d</span>
                            <div style={{ flex: 1, height: 1, background: "#CBD5E1", borderTop: "1px dashed #CBD5E1" }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#3a4055" }}>{n.pod}</span>
                        </div>
                        <div style={{ textAlign: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 9, color: "#3B82F6", fontWeight: 500 }}>via {n.via}</span>
                          <span style={{ fontSize: 9, color: "#8891A5", marginLeft: 6 }}>ETA: {n.eta}</span>
                        </div>

                        {/* Dates */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {[
                            ["ETD:", n.etd, "#1a1f36", false],
                            ["DL Draft:", n.dlDraft, "#B45309", true],
                            ["DL Carga:", n.dlCarga, "#DC2626", true],
                          ].map(([label, val, color, bold], i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 10, color: "#8891A5" }}>{label}</span>
                              <span style={{ fontSize: 10, fontWeight: bold ? 700 : 600, color }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Separator between routes */}
              {ri < routeKeys.length - 1 && (
                <div style={{ height: 1, background: "#E2E6EC", margin: "28px 0 0" }} />
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E6EC", textAlign: "center" }}>
          <p style={{ fontSize: 10, color: "#8891A5" }}>
            Valores sujeitos a disponibilidade de espaço e equipamento no momento da confirmação.
          </p>
          <p style={{ fontSize: 9, color: "#B8C0CE", marginTop: 4 }}>Inter Shipping Ltda. · intershipping.com.br</p>
        </div>
      </div>
    </div>
  );
}
