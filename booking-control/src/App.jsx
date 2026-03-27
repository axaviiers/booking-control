import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { loadState, saveState, subscribeToChanges, supabase } from "./lib/db.js";

const SLA_MS=2*3600000,URGENT_MS=30*60000,THREE_DAYS=3*24*3600000;
const BRAND="#0F4C81",BRAND_LT="#E8F0F8";
const ST={
  Solicitado:{c:"#B45309",bg:"#FEF3C7",bd:"#FDE68A",i:"⏳"},
  "Precisando de estratégia":{c:"#1D4ED8",bg:"#DBEAFE",bd:"#BFDBFE",i:"🧠"},
  "Aguardando contrato":{c:"#7C3AED",bg:"#EDE9FE",bd:"#DDD6FE",i:"📄"},
  Aprovado:{c:"#047857",bg:"#D1FAE5",bd:"#A7F3D0",i:"✅"},
  Cancelado:{c:"#DC2626",bg:"#FEE2E2",bd:"#FECACA",i:"🚫"},
};
const EQ=["Dry 20'","Dry 40'","Dry 40' HC","Reefer 20'","Reefer 40'","Reefer 40' HC","Open Top 20'","Open Top 40'","Flat Rack 20'","Flat Rack 40'","Tank 20'"];
const ARM_DEF=[
  {name:"MSC",ddlDays:0},{name:"Maersk",ddlDays:0},{name:"CMA CGM",ddlDays:12},{name:"Hapag-Lloyd",ddlDays:16},
  {name:"COSCO",ddlDays:0},{name:"Evergreen",ddlDays:0},{name:"ONE",ddlDays:0},{name:"HMM",ddlDays:0},{name:"Yang Ming",ddlDays:0},{name:"ZIM",ddlDays:0},
];
const USR_DEF=[
  {id:"u1",username:"alessandra.xavier@intershipping.com.br",password:"AlessandraX25@",role:"gerencia",name:"Alessandra Xavier"},
  {id:"u2",username:"joao.vitor@intershipping.com.br",password:"joao26@",role:"operador",name:"João Vitor"},
  {id:"u3",username:"cristiane.rodrigues@intershipping.com.br",password:"cris26@",role:"operador",name:"Cristiane Rodrigues"},
  {id:"u4",username:"vitoria.leticia@intershipping.com.br",password:"vitoria26@",role:"operador",name:"Vitória Letícia"},
  {id:"u5",username:"nathalia.reis@intershipping.com.br",password:"nathalia26@",role:"operador",name:"Nathalia Reis"},
  {id:"u6",username:"lucas.santana@intershipping.com.br",password:"lucas26@",role:"operador",name:"Lucas Santana"},
  {id:"u7",username:"julia.milheiro@intershipping.com.br",password:"julia26@",role:"operador",name:"Julia Milheiro"},
  {id:"u8",username:"export@intershipping.com.br",password:"export10",role:"operador",name:"Export"},
  {id:"u9",username:"guilherme.amaral@intershipping.com.br",password:"guilherme26@",role:"operador",name:"Guilherme Amaral"},
];
const TABS=[
  {id:"bookings",label:"Bookings",icon:"📦",c:"#1D4ED8",bg:"#EFF6FF"},
  {id:"pendencias",label:"Pendências",icon:"⚠️",c:"#B45309",bg:"#FFF7ED"},
  {id:"standby",label:"Stand-by",icon:"🚢",c:"#0F766E",bg:"#F0FDFA"},
];
const AClr={"MSC":"#1D4ED8","Maersk":"#0F766E","CMA CGM":"#B45309","Hapag-Lloyd":"#DC2626","COSCO":"#7C3AED","Evergreen":"#047857","ONE":"#BE185D","HMM":"#0369A1","Yang Ming":"#A16207","ZIM":"#6D28D9"};
const aC=a=>AClr[a]||"#475569";
const fT=ms=>{if(ms<=0)return"00:00:00";const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`};
const fD=ts=>ts?new Date(ts).toLocaleDateString("pt-BR"):"—";
const fDt=ts=>new Date(ts).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
const isEsc=r=>(r.status==="Solicitado"||r.status==="Precisando de estratégia")&&(Date.now()-r.createdAt)>SLA_MS;
const isUrg=r=>!!r.isUrgent;
const slaR=r=>(r.status==="Aprovado"||r.status==="Aguardando contrato"||r.status==="Cancelado")?null:SLA_MS-(Date.now()-r.createdAt);
const isExp=r=>r.status==="Aprovado"&&(Date.now()-r.updatedAt)>THREE_DAYS;
const dUntil=d=>{if(!d)return null;return Math.ceil((new Date(d).getTime()-Date.now())/86400000)};

const CSS=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%,75%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
*{box-sizing:border-box;margin:0;padding:0}
input:focus,textarea:focus,select:focus{outline:none;border-color:#6366F1!important;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
::placeholder{color:#94A3B8}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}`;
const iS={width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #E2E8F0",background:"#fff",color:"#1E293B",fontSize:13,fontFamily:"inherit"};
const lS={color:"#64748B",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5};
const selS={...iS,cursor:"pointer",appearance:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%2394A3B8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 10px center"};
const bP={padding:"9px 20px",borderRadius:8,border:"none",background:BRAND,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"};
const bG={padding:"9px 16px",borderRadius:8,border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontSize:13,cursor:"pointer",fontFamily:"inherit"};

function Modal({onClose,children,wide}){
  return(<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.25)",backdropFilter:"blur(3px)"}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{width:wide?680:500,maxHeight:"92vh",overflowY:"auto",background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:28,animation:"fadeUp .25s ease",boxShadow:"0 8px 30px rgba(0,0,0,.1)"}}>{children}</div>
  </div>);
}

// ─── LOGIN ──────────────────────────────────
function Login({onLogin,users,logo}){
  const[u,setU]=useState("");const[p,setP]=useState("");const[err,setErr]=useState("");const[shk,setShk]=useState(false);
  const go=()=>{const f=users.find(x=>x.username===u&&x.password===p);if(f)onLogin(f);else{setErr("Credenciais inválidas");setShk(true);setTimeout(()=>setShk(false),500)}};
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#F0F4F8,#E2E8F0)",fontFamily:"'Inter',sans-serif"}}>
      <style>{CSS}</style>
      <div style={{animation:shk?"shake .4s":"fadeUp .5s",width:400,background:"#fff",border:"1px solid #E2E8F0",borderRadius:16,padding:44,boxShadow:"0 4px 24px rgba(0,0,0,.06)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          {logo?<img src={logo} alt="Logo" style={{maxHeight:60,maxWidth:200,margin:"0 auto 14px",display:"block"}}/>:
          <div style={{width:60,height:60,borderRadius:14,background:BRAND,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",color:"#fff",fontSize:14,fontWeight:700,lineHeight:1.1}}><span style={{textAlign:"center"}}>INTER<br/>SHIP</span></div>}
          <h1 style={{color:BRAND,fontSize:20,fontWeight:700}}>Booking Control</h1>
          <p style={{color:"#94A3B8",fontSize:12,marginTop:4}}>Inter Shipping</p>
        </div>
        <div style={{marginBottom:16}}><label style={lS}>E-mail / Usuário</label><input value={u} onChange={e=>{setU(e.target.value);setErr("")}} onKeyDown={e=>e.key==="Enter"&&go()} style={iS}/></div>
        <div style={{marginBottom:24}}><label style={lS}>Senha</label><input type="password" value={p} onChange={e=>{setP(e.target.value);setErr("")}} onKeyDown={e=>e.key==="Enter"&&go()} style={iS}/></div>
        {err&&<p style={{color:"#DC2626",fontSize:12,textAlign:"center",marginBottom:12}}>{err}</p>}
        <button onClick={go} style={{...bP,width:"100%",padding:"13px 0",borderRadius:10,fontSize:15}}>Entrar</button>
        {!supabase&&<p style={{color:"#F59E0B",fontSize:10,textAlign:"center",marginTop:12}}>⚠ Modo local — dados não compartilhados</p>}
      </div>
    </div>);
}

function UserManager({users,onSave,onClose}){
  const[list,setList]=useState(users.map(u=>({...u})));
  const[form,setForm]=useState({username:"",password:"",name:"",role:"operador"});
  const[mode,setMode]=useState("list");const[editId,setEditId]=useState(null);
  const sf=(k,v)=>setForm(p=>({...p,[k]:v}));
  const visible=list.filter(u=>!u._del);
  return(<Modal onClose={onClose} wide>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><h2 style={{fontSize:17,fontWeight:700}}>Gestão de Usuários</h2><p style={{color:"#94A3B8",fontSize:12}}>Cadastrar, editar e excluir colaboradores</p></div>
      {mode==="list"&&<button onClick={()=>{setForm({username:"",password:"",name:"",role:"operador"});setMode("add")}} style={{...bP,padding:"8px 16px",fontSize:12}}>+ Novo</button>}
    </div>
    {mode!=="list"&&<div style={{padding:16,borderRadius:10,background:"#F8FAFC",border:"1px solid #E2E8F0",marginBottom:16}}>
      <p style={{color:BRAND,fontSize:11,fontWeight:700,textTransform:"uppercase",marginBottom:12}}>{mode==="add"?"Novo Usuário":"Editar Usuário"}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><label style={lS}>Nome *</label><input value={form.name} onChange={e=>sf("name",e.target.value)} style={iS}/></div>
        <div><label style={lS}>Perfil *</label><select value={form.role} onChange={e=>sf("role",e.target.value)} style={selS}><option value="operador">Operador</option><option value="gerencia">Gerência</option></select></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><label style={lS}>Login *</label><input value={form.username} onChange={e=>sf("username",e.target.value)} style={iS}/></div>
        <div><label style={lS}>Senha *</label><input value={form.password} onChange={e=>sf("password",e.target.value)} style={iS}/></div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={()=>{setMode("list");setEditId(null)}} style={{...bG,fontSize:12}}>Cancelar</button>
        <button onClick={()=>{if(!form.name||!form.password)return;if(mode==="add"){if(!form.username||list.find(x=>x.username===form.username&&!x._del))return;setList([...list,{id:`u${Date.now()}`,...form}])}else{setList(list.map(u=>u.id===editId?{...u,username:form.username,name:form.name,password:form.password,role:form.role}:u))}setMode("list");setEditId(null)}} style={{...bP,fontSize:12}}>Salvar</button>
      </div>
    </div>}
    <div style={{maxHeight:300,overflowY:"auto",marginBottom:16}}>
      {visible.map(u=><div key={u.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",borderRadius:8,marginBottom:4,background:"#F8FAFC"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:7,background:u.role==="gerencia"?"#FEF3C7":"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{u.role==="gerencia"?"👑":"👤"}</div>
          <div><p style={{fontSize:13,fontWeight:600}}>{u.name}</p><p style={{fontSize:10,color:"#94A3B8"}}>{u.username}</p></div></div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>{setForm({username:u.username,password:u.password,name:u.name,role:u.role});setEditId(u.id);setMode("edit")}} style={{background:"none",border:"none",color:BRAND,cursor:"pointer",fontSize:11,fontWeight:600}}>Editar</button>
          {visible.length>1&&<button onClick={()=>setList(list.map(x=>x.id===u.id?{...x,_del:true}:x))} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:11}}>Excluir</button>}
        </div>
      </div>)}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>onSave(visible)} style={bP}>Salvar</button></div>
  </Modal>);
}

function ArmadorManager({armadores,onSave,onClose}){
  const[list,setList]=useState(armadores.map(a=>({...a})));
  const[nn,setNn]=useState("");const[nd,setNd]=useState(0);
  const add=()=>{if(nn.trim()&&!list.find(a=>a.name===nn.trim())){setList([...list,{name:nn.trim(),ddlDays:nd}]);setNn("");setNd(0)}};
  return(<Modal onClose={onClose} wide>
    <h2 style={{fontSize:17,fontWeight:700,marginBottom:4}}>Gerenciar Armadores</h2>
    <p style={{color:"#94A3B8",fontSize:12,marginBottom:16}}>Dias de alerta antes do Deadline de Carga</p>
    <div style={{display:"flex",gap:8,marginBottom:16}}>
      <input value={nn} onChange={e=>setNn(e.target.value)} placeholder="Nome" style={{...iS,flex:1}}/>
      <input type="number" min={0} value={nd} onChange={e=>setNd(parseInt(e.target.value)||0)} placeholder="DDL" style={{...iS,width:80}}/>
      <button onClick={add} style={{...bP,padding:"9px 16px"}}>+</button>
    </div>
    <div style={{maxHeight:280,overflowY:"auto",marginBottom:16}}>
      {list.map((a,i)=><div key={a.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderRadius:6,background:"#F8FAFC",marginBottom:3}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:4,background:aC(a.name)}}/><span style={{fontSize:13,fontWeight:500}}>{a.name}</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="number" min={0} value={a.ddlDays} onChange={e=>setList(list.map((x,j)=>j===i?{...x,ddlDays:parseInt(e.target.value)||0}:x))} style={{width:60,padding:"4px 8px",borderRadius:6,border:"1px solid #E2E8F0",fontSize:12,textAlign:"center"}}/>
          <span style={{fontSize:10,color:"#94A3B8"}}>dias</span>
          <button onClick={()=>setList(list.filter(x=>x.name!==a.name))} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer"}}>✕</button>
        </div>
      </div>)}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>onSave(list)} style={bP}>Salvar</button></div>
  </Modal>);
}

function LogoManager({logo,onSave,onClose}){
  const handleFile=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>onSave(ev.target.result);reader.readAsDataURL(file)};
  return(<Modal onClose={onClose}>
    <h2 style={{fontSize:17,fontWeight:700,marginBottom:16}}>Logo da Empresa</h2>
    {logo&&<div style={{marginBottom:16,textAlign:"center"}}><img src={logo} alt="Logo" style={{maxHeight:80,maxWidth:300}}/></div>}
    <div style={{marginBottom:16}}><label style={lS}>Upload (PNG/JPG)</label><input type="file" accept="image/*" onChange={handleFile} style={{fontSize:13}}/></div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>{logo&&<button onClick={()=>onSave(null)} style={{...bG,color:"#DC2626"}}>Remover</button>}<button onClick={onClose} style={bG}>Fechar</button></div>
  </Modal>);
}

function NewBookingModal({onClose,onSave,armadores}){
  const arms=armadores.map(a=>a.name);
  const[f,setF]=useState({client:"",clientRef:"",subject:"",emailSubject:"",bookingNumber:"",equipQty:1,equipType:EQ[0],pol:"",pod:"",armador:arms[0]||"",isUrgent:false,urgentNote:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));const ok=f.client&&f.subject&&f.pol&&f.pod&&f.armador;
  return(<Modal onClose={onClose} wide>
    <h2 style={{fontSize:17,fontWeight:700,marginBottom:20}}>Nova Solicitação</h2>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><div><label style={lS}>Cliente *</label><input value={f.client} onChange={e=>s("client",e.target.value)} style={iS}/></div><div><label style={lS}>Referência</label><input value={f.clientRef} onChange={e=>s("clientRef",e.target.value)} style={iS}/></div></div>
    <div style={{marginBottom:12}}><label style={lS}>Assunto *</label><input value={f.subject} onChange={e=>s("subject",e.target.value)} style={iS}/></div>
    <div style={{marginBottom:12,padding:10,borderRadius:8,background:"#F5F3FF",border:"1px solid #EDE9FE"}}><label style={{...lS,color:"#7C3AED"}}>📧 E-mail</label><input value={f.emailSubject} onChange={e=>s("emailSubject",e.target.value)} style={{...iS,border:"1px solid #DDD6FE"}}/></div>
    <div style={{marginBottom:12}}><label style={lS}>Nº Booking</label><input value={f.bookingNumber} onChange={e=>s("bookingNumber",e.target.value)} style={iS}/></div>
    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:12,marginBottom:12}}><div><label style={lS}>Qtd</label><input type="number" min={1} value={f.equipQty} onChange={e=>s("equipQty",Math.max(1,parseInt(e.target.value)||1))} style={iS}/></div><div><label style={lS}>Equipamento</label><select value={f.equipType} onChange={e=>s("equipType",e.target.value)} style={selS}>{EQ.map(t=><option key={t}>{t}</option>)}</select></div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><div><label style={lS}>POL *</label><input value={f.pol} onChange={e=>s("pol",e.target.value)} style={iS}/></div><div><label style={lS}>POD *</label><input value={f.pod} onChange={e=>s("pod",e.target.value)} style={iS}/></div></div>
    <div style={{marginBottom:12}}><label style={lS}>Armador *</label><select value={f.armador} onChange={e=>s("armador",e.target.value)} style={selS}>{arms.map(a=><option key={a}>{a}</option>)}</select></div>
    <div style={{marginBottom:18,padding:12,borderRadius:8,background:"#FEF2F2",border:"1px solid #FECACA"}}>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:f.isUrgent?8:0}}><input type="checkbox" checked={f.isUrgent} onChange={e=>s("isUrgent",e.target.checked)} style={{width:16,height:16,accentColor:"#DC2626"}}/><span style={{color:"#DC2626",fontSize:13,fontWeight:600}}>🔴 URGENTE</span></label>
      {f.isUrgent&&<input value={f.urgentNote} onChange={e=>s("urgentNote",e.target.value)} placeholder="Motivo..." style={{...iS,border:"1px solid #FECACA"}}/>}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>ok&&onSave(f)} style={{...bP,opacity:ok?1:.5}}>Criar</button></div>
  </Modal>);
}

function BookingDetail({req,onClose,onChangeStatus,onUpdate,user}){
  const[obsText,setObsText]=useState("");
  const addObs=()=>{if(!obsText.trim())return;onUpdate(req.id,{observations:[...(req.observations||[]),{text:obsText.trim(),by:user.name,at:Date.now()}]});setObsText("")};
  return(<Modal onClose={onClose} wide>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
      <div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
          <span style={{color:"#94A3B8",fontSize:12,fontWeight:600}}>{req.id}</span>
          <span style={{padding:"2px 8px",borderRadius:16,fontSize:10,fontWeight:600,background:ST[req.status]?.bg,color:ST[req.status]?.c}}>{ST[req.status]?.i} {req.status}</span>
          {req.isUrgent&&<span style={{background:"#FEF2F2",color:"#DC2626",padding:"2px 8px",borderRadius:16,fontSize:10,fontWeight:700}}>🔴 URGENTE</span>}
        </div>
        <h2 style={{fontSize:16,fontWeight:700}}>{req.subject}</h2>
        {req.isUrgent&&req.urgentNote&&<p style={{color:"#DC2626",fontSize:11,marginTop:2}}>Motivo: {req.urgentNote}</p>}
      </div>
      <button onClick={onClose} style={{background:"none",border:"none",color:"#94A3B8",fontSize:18,cursor:"pointer"}}>✕</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
      {[["Cliente",req.client],["Ref.",req.clientRef],["Booking",req.bookingNumber||"Pendente"],["Equip.",`${req.equipQty}x ${req.equipType}`],["Armador",req.armador],["E-mail",req.emailSubject]].map(([l,v],i)=><div key={i} style={{padding:"7px 10px",borderRadius:6,background:"#F8FAFC"}}><p style={{color:"#94A3B8",fontSize:9,textTransform:"uppercase"}}>{l}</p><p style={{color:"#334155",fontSize:12,fontWeight:500}}>{v||"—"}</p></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
      <div style={{padding:"7px 10px",borderRadius:6,background:"#EFF6FF"}}><p style={{color:"#94A3B8",fontSize:9}}>POL</p><p style={{color:"#1D4ED8",fontSize:13,fontWeight:600}}>🚢 {req.pol}</p></div>
      <div style={{padding:"7px 10px",borderRadius:6,background:"#ECFDF5"}}><p style={{color:"#94A3B8",fontSize:9}}>POD</p><p style={{color:"#047857",fontSize:13,fontWeight:600}}>📍 {req.pod}</p></div>
    </div>
    {req.history?.length>0&&<div style={{marginBottom:8}}><p style={lS}>Histórico</p><div style={{background:"#F8FAFC",borderRadius:6,padding:6}}>{req.history.map((h,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",fontSize:10,color:"#64748B"}}><span style={{fontWeight:600,minWidth:85}}>{fDt(h.at)}</span><span style={{padding:"1px 6px",borderRadius:10,background:ST[h.from]?.bg,color:ST[h.from]?.c,fontSize:9}}>{h.from}</span>→<span style={{padding:"1px 6px",borderRadius:10,background:ST[h.to]?.bg,color:ST[h.to]?.c,fontSize:9}}>{h.to}</span><span>{h.by}</span></div>)}</div></div>}
    <div style={{marginBottom:10}}><p style={lS}>Observações</p>
      {(req.observations||[]).map((o,i)=><div key={i} style={{padding:"6px 10px",borderRadius:6,background:"#FFFBEB",border:"1px solid #FEF3C7",marginBottom:3}}><p style={{fontSize:12}}>{o.text}</p><p style={{fontSize:9,color:"#94A3B8",marginTop:1}}>{o.by} · {fDt(o.at)}</p></div>)}
      <div style={{display:"flex",gap:6}}><input value={obsText} onChange={e=>setObsText(e.target.value)} placeholder="Observação..." style={{...iS,flex:1}} onKeyDown={e=>{if(e.key==="Enter")addObs()}}/><button onClick={addObs} style={{...bP,padding:"8px 14px",fontSize:11}}>Enviar</button></div>
    </div>
    {req.status!=="Aprovado"&&req.status!=="Cancelado"&&<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{Object.keys(ST).filter(s=>s!==req.status).map(s=><button key={s} onClick={()=>onChangeStatus(req.id,s)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${ST[s].bd}`,background:ST[s].bg,color:ST[s].c,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{ST[s].i} {s}</button>)}</div>}
  </Modal>);
}

function NewPendenciaModal({onClose,onSave}){
  const[bn,setBn]=useState("");const[obs,setObs]=useState("");
  return(<Modal onClose={onClose}><h2 style={{color:"#B45309",fontSize:16,fontWeight:700,marginBottom:16}}>Nova Pendência</h2>
    <div style={{marginBottom:12}}><label style={lS}>Nº do Booking *</label><input value={bn} onChange={e=>setBn(e.target.value)} style={iS}/></div>
    <div style={{marginBottom:16}}><label style={lS}>O que está pendente? *</label><textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3} style={{...iS,resize:"vertical"}}/></div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>{if(bn&&obs)onSave({bookingNumber:bn,observation:obs})}} style={{...bP,background:"#B45309",opacity:bn&&obs?1:.5}}>Adicionar</button></div>
  </Modal>);
}

function ShipModal({onClose,onSave,armadores,initial}){
  const arms=armadores.map(a=>a.name);
  const d=initial||{nome:"",armador:arms[0]||"",pol:"",pod:"",previsaoSaida:"",dataCancelamento:"",qtdTotal:0,qtdUsando:0,reservas:"",cliente:"",observation:""};
  const[f,setF]=useState({...d,previsaoSaida:d.previsaoSaida?String(d.previsaoSaida).split("T")[0]:"",dataCancelamento:d.dataCancelamento?String(d.dataCancelamento).split("T")[0]:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));const ok=f.nome&&f.armador&&f.pol&&f.pod;
  return(<Modal onClose={onClose} wide>
    <h2 style={{color:"#0F766E",fontSize:16,fontWeight:700,marginBottom:16}}>{initial?"Editar Navio":"Novo Navio"}</h2>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><div><label style={lS}>Nome do Navio *</label><input value={f.nome} onChange={e=>s("nome",e.target.value)} style={iS}/></div><div><label style={lS}>Armador *</label><select value={f.armador} onChange={e=>s("armador",e.target.value)} style={selS}>{arms.map(a=><option key={a}>{a}</option>)}</select></div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><div><label style={lS}>POL *</label><input value={f.pol} onChange={e=>s("pol",e.target.value)} style={iS}/></div><div><label style={lS}>POD *</label><input value={f.pod} onChange={e=>s("pod",e.target.value)} style={iS}/></div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><div><label style={lS}>Previsão de Saída</label><input type="date" value={f.previsaoSaida} onChange={e=>s("previsaoSaida",e.target.value)} style={iS}/></div><div><label style={lS}>Cancelamento Reserva</label><input type="date" value={f.dataCancelamento} onChange={e=>s("dataCancelamento",e.target.value)} style={iS}/></div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Qtd Total</label><input type="number" min={0} value={f.qtdTotal} onChange={e=>s("qtdTotal",parseInt(e.target.value)||0)} style={iS}/></div>
      <div><label style={lS}>Usando</label><input type="number" min={0} value={f.qtdUsando} onChange={e=>s("qtdUsando",parseInt(e.target.value)||0)} style={iS}/></div>
      <div style={{padding:8,borderRadius:6,background:f.qtdTotal-f.qtdUsando>0?"#D1FAE5":"#FEF2F2",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}><p style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase"}}>Sobrando</p><p style={{fontSize:18,fontWeight:700,color:f.qtdTotal-f.qtdUsando>0?"#047857":"#DC2626"}}>{f.qtdTotal-f.qtdUsando}</p></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}><div><label style={lS}>Reservas</label><input value={f.reservas||""} onChange={e=>s("reservas",e.target.value)} style={iS}/></div><div><label style={lS}>Cliente</label><input value={f.cliente||""} onChange={e=>s("cliente",e.target.value)} style={iS}/></div></div>
    <div style={{marginBottom:16}}><label style={lS}>Observações</label><textarea value={f.observation||""} onChange={e=>s("observation",e.target.value)} rows={2} style={{...iS,resize:"vertical"}}/></div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>ok&&onSave(f)} style={{...bP,background:"#0F766E",opacity:ok?1:.5}}>Salvar</button></div>
  </Modal>);
}

// ─── ADD BOOKING TO SHIP — campos do primeiro + deadline de carga ───
function AddShipBookingModal({onClose,onSave,ship}){
  const first=ship.bookings[0];
  const[f,setF]=useState({
    bookingNumber:"",
    client:first?.client||ship.cliente||"",
    clientRef:first?.clientRef||"",
    equipQty:first?.equipQty||1,
    equipType:first?.equipType||EQ[0],
    pol:first?.pol||ship.pol||"",
    pod:first?.pod||ship.pod||"",
    reservas:first?.reservas||ship.reservas||"",
    deadlineCarga:"",
    observation:""
  });
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  return(<Modal onClose={onClose} wide>
    <h2 style={{color:"#0F766E",fontSize:16,fontWeight:700,marginBottom:4}}>Booking no Navio {ship.nome}</h2>
    <p style={{color:"#64748B",fontSize:11,marginBottom:16}}>Armador: <strong>{ship.armador}</strong>{first?" · Dados pré-preenchidos do 1º booking":""}</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Nº Booking</label><input value={f.bookingNumber} onChange={e=>s("bookingNumber",e.target.value)} style={iS}/></div>
      <div><label style={lS}>Cliente</label><input value={f.client} onChange={e=>s("client",e.target.value)} style={iS}/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Referência</label><input value={f.clientRef} onChange={e=>s("clientRef",e.target.value)} style={iS}/></div>
      <div><label style={lS}>Reservas</label><input value={f.reservas} onChange={e=>s("reservas",e.target.value)} style={iS}/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Qtd</label><input type="number" min={1} value={f.equipQty} onChange={e=>s("equipQty",Math.max(1,parseInt(e.target.value)||1))} style={iS}/></div>
      <div><label style={lS}>Equipamento</label><select value={f.equipType} onChange={e=>s("equipType",e.target.value)} style={selS}>{EQ.map(t=><option key={t}>{t}</option>)}</select></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>POL</label><input value={f.pol} onChange={e=>s("pol",e.target.value)} style={iS}/></div>
      <div><label style={lS}>POD</label><input value={f.pod} onChange={e=>s("pod",e.target.value)} style={iS}/></div>
    </div>
    <div style={{marginBottom:12,padding:12,borderRadius:8,background:"#FEF2F2",border:"1px solid #FECACA"}}>
      <label style={{...lS,color:"#DC2626"}}>⏰ Deadline de Carga</label>
      <input type="date" value={f.deadlineCarga} onChange={e=>s("deadlineCarga",e.target.value)} style={{...iS,border:"1px solid #FECACA"}}/>
    </div>
    <div style={{marginBottom:16}}><label style={lS}>Observação</label><textarea value={f.observation} onChange={e=>s("observation",e.target.value)} rows={2} style={{...iS,resize:"vertical"}}/></div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>onSave(f)} style={{...bP,background:"#0F766E"}}>Adicionar</button></div>
  </Modal>);
}

function Notifications({bookings,ships,armadores}){
  const notes=[];
  const esc=bookings.filter(isEsc);
  if(esc.length>0)notes.push({msg:`🚨 ${esc.length} booking(s) estourou(aram) o SLA de 2h!`,color:"#DC2626",bg:"#FEF2F2",bd:"#FECACA"});
  armadores.forEach(arm=>{
    if(arm.ddlDays<=0)return;
    ships.filter(s=>s.armador===arm.name).forEach(s=>{
      s.bookings.forEach(b=>{
        if(!b.deadlineCarga)return;
        const d=dUntil(b.deadlineCarga);
        if(d!==null&&d<=arm.ddlDays&&d>=0)notes.push({msg:`⏰ ${arm.name} — "${s.nome}" BKG ${b.bookingNumber||"s/n"}: DDL carga em ${d}d!`,color:aC(arm.name),bg:"#FEF2F2",bd:"#FECACA"});
      });
      const dc=dUntil(s.dataCancelamento);
      if(dc!==null&&dc<=arm.ddlDays&&dc>=0)notes.push({msg:`⏰ ${arm.name} — "${s.nome}": Cancelamento reserva em ${dc}d!`,color:aC(arm.name),bg:"#FFF7ED",bd:"#FED7AA"});
    });
  });
  if(!notes.length)return null;
  return(<div style={{marginBottom:12}}>{notes.map((n,i)=><div key={i} style={{padding:"10px 14px",borderRadius:10,background:n.bg,border:`1px solid ${n.bd}`,marginBottom:6,animation:"slideIn .4s"}}><p style={{color:n.color,fontWeight:700,fontSize:12}}>{n.msg}</p></div>)}</div>);
}

// ─── PANELS ─────────────────────────────────
function BookingsPanel({data,setData,armadores,user}){
  const[showNew,setShowNew]=useState(false);const[sel,setSel]=useState(null);const[filter,setFilter]=useState("Todos");const[tick,setTick]=useState(0);
  useEffect(()=>{const i=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(i)},[]);
  useEffect(()=>{if(data.some(isExp))setData(prev=>prev.filter(r=>!isExp(r)))},[data]);
  const escC=data.filter(isEsc).length,urgC=data.filter(isUrg).length;
  const filt=filter==="Todos"?data:filter==="Escalonados"?data.filter(isEsc):filter==="Urgentes"?data.filter(isUrg):data.filter(r=>r.status===filter);
  const addReq=f=>{setData(prev=>[{id:`BK-${String(prev.length+1).padStart(3,"0")}`,status:"Solicitado",createdAt:Date.now(),updatedAt:Date.now(),createdBy:user.name,history:[],observations:[],...f},...prev]);setShowNew(false)};
  const chgSt=(id,s)=>{setData(prev=>prev.map(r=>r.id===id?{...r,status:s,updatedAt:Date.now(),history:[...r.history,{from:r.status,to:s,at:Date.now(),by:user.name}]}:r));setSel(null)};
  const updReq=(id,fields)=>{setData(prev=>prev.map(r=>r.id===id?{...r,...fields,updatedAt:Date.now()}:r));setSel(prev=>prev?{...prev,...fields}:prev)};
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:16}}>
      {[{l:"Total",v:data.length,c:"#475569",bg:"#F8FAFC",bd:"#E2E8F0"},{l:"Solicitado",v:data.filter(r=>r.status==="Solicitado").length,c:"#B45309",bg:"#FEF3C7",bd:"#FDE68A"},{l:"Urgentes",v:urgC,c:"#DC2626",bg:"#FEF2F2",bd:"#FECACA"},{l:"Aprovado",v:data.filter(r=>r.status==="Aprovado").length,c:"#047857",bg:"#D1FAE5",bd:"#A7F3D0"},{l:"Cancelado",v:data.filter(r=>r.status==="Cancelado").length,c:"#DC2626",bg:"#FEE2E2",bd:"#FECACA"},{l:"Escalonado",v:escC,c:escC?"#DC2626":"#94A3B8",bg:escC?"#FEF2F2":"#F8FAFC",bd:escC?"#FECACA":"#E2E8F0"}].map((s,i)=>
        <div key={i} onClick={()=>setFilter(s.l==="Total"?"Todos":s.l==="Escalonado"?"Escalonados":s.l)} style={{padding:"12px 8px",borderRadius:10,background:s.bg,border:`1px solid ${s.bd}`,textAlign:"center",cursor:"pointer",transition:"transform .15s"}} onMouseOver={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseOut={e=>e.currentTarget.style.transform="none"}><p style={{fontSize:20,fontWeight:700,color:s.c}}>{s.v}</p><p style={{color:"#94A3B8",fontSize:8,fontWeight:600,textTransform:"uppercase"}}>{s.l}</p></div>)}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{["Todos","Solicitado","Precisando de estratégia","Aguardando contrato","Urgentes","Aprovado","Cancelado","Escalonados"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 10px",borderRadius:6,border:filter===f?"none":"1px solid #E2E8F0",background:filter===f?BRAND_LT:"#fff",color:filter===f?BRAND:"#64748B",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{f}</button>)}</div>
      <button onClick={()=>setShowNew(true)} style={{...bP,padding:"7px 16px",fontSize:11}}>+ Novo Booking</button>
    </div>
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
      <thead><tr style={{borderBottom:"2px solid #F1F5F9",background:"#FAFBFC"}}>{["","ID","Cliente","Assunto","Booking","Equip.","Rota","Armador","Status","SLA"].map((h,i)=><th key={i} style={{padding:"10px 5px",textAlign:"left",color:"#94A3B8",fontSize:9,fontWeight:700,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
      <tbody>{filt.map(r=>{const esc=isEsc(r),urg=isUrg(r),sla=slaR(r),warn=sla!==null&&sla>0&&sla<URGENT_MS;
        return(<tr key={r.id} onClick={()=>setSel(r)} style={{borderBottom:"1px solid #F1F5F9",background:esc?"#FEF2F2":urg?"#FEF2F2":"#fff",cursor:"pointer"}} onMouseOver={e=>{if(!esc&&!urg)e.currentTarget.style.background="#F8FAFC"}} onMouseOut={e=>{e.currentTarget.style.background=esc?"#FEF2F2":urg?"#FEF2F2":"#fff"}}>
          <td style={{padding:"10px 4px",width:20}}>{urg&&<span title={r.urgentNote}>🔴</span>}{esc&&!urg&&<span style={{animation:"pulse 1s ease infinite",fontSize:10}}>🟠</span>}</td>
          <td style={{padding:"10px 5px",fontSize:11,color:"#94A3B8",fontWeight:600}}>{r.id}</td>
          <td style={{padding:"10px 5px"}}><p style={{fontSize:12,fontWeight:600}}>{r.client}</p></td>
          <td style={{padding:"10px 5px",fontSize:11,color:"#475569",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.subject}</td>
          <td style={{padding:"10px 5px",fontSize:11,color:r.bookingNumber?"#475569":"#CBD5E1"}}>{r.bookingNumber||"—"}</td>
          <td style={{padding:"10px 5px",fontSize:11,whiteSpace:"nowrap"}}>{r.equipQty}x {r.equipType}</td>
          <td style={{padding:"10px 5px",whiteSpace:"nowrap"}}><span style={{color:"#1D4ED8",fontSize:11}}>{r.pol}</span><span style={{color:"#CBD5E1",margin:"0 2px"}}>→</span><span style={{color:"#047857",fontSize:11}}>{r.pod}</span></td>
          <td style={{padding:"10px 5px"}}><span style={{padding:"2px 6px",borderRadius:12,fontSize:9,fontWeight:600,background:`${aC(r.armador)}12`,color:aC(r.armador)}}>{r.armador}</span></td>
          <td style={{padding:"10px 5px"}}><span style={{padding:"2px 6px",borderRadius:16,fontSize:9,fontWeight:600,background:ST[r.status]?.bg,color:ST[r.status]?.c}}>{ST[r.status]?.i} {r.status}</span></td>
          <td style={{padding:"10px 5px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",color:sla===null?"#047857":sla>0?(warn?"#B45309":"#475569"):"#DC2626"}}>{sla===null?"✓":sla>0?fT(sla):<span style={{animation:"pulse 1.5s ease infinite"}}>ESTOURADO</span>}</td>
        </tr>)})}
        {filt.length===0&&<tr><td colSpan={10} style={{padding:32,textAlign:"center",color:"#94A3B8",fontSize:12}}>Nenhuma solicitação</td></tr>}
      </tbody></table></div></div>
    {showNew&&<NewBookingModal onClose={()=>setShowNew(false)} onSave={addReq} armadores={armadores}/>}
    {sel&&<BookingDetail req={sel} onClose={()=>setSel(null)} onChangeStatus={chgSt} onUpdate={updReq} user={user}/>}
  </div>);
}

function PendenciasPanel({data,setData,user}){
  const[showNew,setShowNew]=useState(false);
  const pending=data.filter(d=>!d.resolved),resolved=data.filter(d=>d.resolved);
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{display:"flex",gap:12}}>
        <div style={{padding:"12px 20px",borderRadius:10,background:"#FEF3C7",border:"1px solid #FDE68A",textAlign:"center"}}><p style={{fontSize:22,fontWeight:700,color:"#B45309"}}>{pending.length}</p><p style={{fontSize:9,fontWeight:600,textTransform:"uppercase",color:"#92400E"}}>Pendentes</p></div>
        <div style={{padding:"12px 20px",borderRadius:10,background:"#D1FAE5",border:"1px solid #A7F3D0",textAlign:"center"}}><p style={{fontSize:22,fontWeight:700,color:"#047857"}}>{resolved.length}</p><p style={{fontSize:9,fontWeight:600,textTransform:"uppercase",color:"#065F46"}}>Resolvidas</p></div>
      </div>
      <button onClick={()=>setShowNew(true)} style={{...bP,background:"#B45309",padding:"8px 16px",fontSize:11}}>+ Pendência</button>
    </div>
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
      {pending.map(p=><div key={p.id} style={{padding:"12px 16px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><p style={{fontSize:13,fontWeight:600}}>BKG: <span style={{color:"#B45309"}}>{p.bookingNumber}</span></p><p style={{fontSize:12,color:"#64748B",marginTop:2}}>{p.observation}</p><p style={{fontSize:9,color:"#94A3B8",marginTop:2}}>{p.createdBy} · {fDt(p.createdAt)}</p></div>
        <button onClick={()=>setData(prev=>prev.map(x=>x.id===p.id?{...x,resolved:true}:x))} style={{padding:"6px 12px",borderRadius:6,border:"1px solid #A7F3D0",background:"#D1FAE5",color:"#047857",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✓</button>
      </div>)}
      {!pending.length&&<div style={{padding:32,textAlign:"center",color:"#94A3B8",fontSize:12}}>Nenhuma pendência</div>}
    </div>
    {showNew&&<NewPendenciaModal onClose={()=>setShowNew(false)} onSave={f=>{setData(prev=>[{id:`PD-${Date.now()}`,...f,resolved:false,createdBy:user.name,createdAt:Date.now()},...prev]);setShowNew(false)}}/>}
  </div>);
}

function StandbyPanel({ships,setShips,armadores,user}){
  const[showNew,setShowNew]=useState(false);const[editShip,setEditShip]=useState(null);const[addBkgTo,setAddBkgTo]=useState(null);const[colArm,setColArm]=useState({});const[colShip,setColShip]=useState({});
  const arms=armadores.map(a=>a.name);
  const grouped=useMemo(()=>{const g={};arms.forEach(a=>{g[a]=ships.filter(s=>s.armador===a)});return g},[ships,arms]);
  const delShip=id=>{if(window.confirm("Excluir este navio e todos os bookings?"))setShips(prev=>prev.filter(s=>s.id!==id))};
  const delBkg=(shipId,bkgId)=>setShips(prev=>prev.map(s=>s.id===shipId?{...s,bookings:s.bookings.filter(b=>b.id!==bkgId)}:s));

  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{display:"flex",gap:12}}>
        <div style={{padding:"12px 20px",borderRadius:10,background:"#F0FDFA",border:"1px solid #99F6E4",textAlign:"center"}}><p style={{fontSize:22,fontWeight:700,color:"#0F766E"}}>{ships.length}</p><p style={{fontSize:9,fontWeight:600,textTransform:"uppercase",color:"#115E59"}}>Navios</p></div>
        <div style={{padding:"12px 20px",borderRadius:10,background:"#DBEAFE",border:"1px solid #BFDBFE",textAlign:"center"}}><p style={{fontSize:22,fontWeight:700,color:"#1D4ED8"}}>{ships.reduce((a,s)=>a+s.bookings.length,0)}</p><p style={{fontSize:9,fontWeight:600,textTransform:"uppercase",color:"#1E40AF"}}>Bookings</p></div>
      </div>
      <button onClick={()=>setShowNew(true)} style={{...bP,background:"#0F766E",padding:"8px 16px",fontSize:11}}>+ Novo Navio</button>
    </div>

    {arms.filter(a=>grouped[a]?.length>0).map(arm=>{
      const col=aC(arm);const collapsed=colArm[arm];const armShips=grouped[arm];const armCfg=armadores.find(a=>a.name===arm);
      const tot=armShips.reduce((a,s)=>a+s.qtdTotal,0),uso=armShips.reduce((a,s)=>a+s.qtdUsando,0);
      let nearDdl=null;armShips.forEach(s=>s.bookings.forEach(b=>{if(b.deadlineCarga){const d=dUntil(b.deadlineCarga);if(d!==null&&d>=0&&(nearDdl===null||d<nearDdl))nearDdl=d}}));
      return(<div key={arm} style={{marginBottom:16}}>
        <div onClick={()=>setColArm(p=>({...p,[arm]:!p[arm]}))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderRadius:collapsed?"10px":"10px 10px 0 0",background:`${col}10`,border:`1px solid ${col}25`,cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:4,background:col}}/><h3 style={{fontSize:14,fontWeight:700,color:col}}>{arm}</h3>
            <span style={{padding:"2px 8px",borderRadius:10,background:`${col}15`,color:col,fontSize:10,fontWeight:600}}>{armShips.length} navio{armShips.length>1?"s":""}</span>
            {armCfg?.ddlDays>0&&<span style={{padding:"2px 6px",borderRadius:10,background:"#FEF2F2",color:"#DC2626",fontSize:9,fontWeight:600}}>DDL {armCfg.ddlDays}d</span>}
            {nearDdl!==null&&armCfg?.ddlDays>0&&nearDdl<=armCfg.ddlDays&&<span style={{padding:"2px 6px",borderRadius:10,background:"#DC2626",color:"#fff",fontSize:9,fontWeight:700,animation:"pulse 1.5s ease infinite"}}>⏰ {nearDdl}d!</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:10,color:"#64748B"}}>T:<strong style={{color:col}}>{tot}</strong> U:<strong>{uso}</strong> S:<strong style={{color:tot-uso>0?"#047857":"#DC2626"}}>{tot-uso}</strong></span>
            <span style={{color:"#94A3B8"}}>{collapsed?"▸":"▾"}</span>
          </div>
        </div>
        {!collapsed&&<div style={{border:`1px solid ${col}15`,borderTop:"none",borderRadius:"0 0 10px 10px",background:"#fff"}}>
          {armShips.map(ship=>{
            const sobra=ship.qtdTotal-ship.qtdUsando;const shipCol=colShip[ship.id];
            let sDdl=null;ship.bookings.forEach(b=>{if(b.deadlineCarga){const d=dUntil(b.deadlineCarga);if(d!==null&&d>=0&&(sDdl===null||d<sDdl))sDdl=d}});
            const ddlAlert=armCfg?.ddlDays>0&&sDdl!==null&&sDdl<=armCfg.ddlDays;
            return(<div key={ship.id} style={{borderBottom:`1px solid ${col}10`}}>
              <div onClick={()=>setColShip(p=>({...p,[ship.id]:!p[ship.id]}))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",cursor:"pointer",background:ddlAlert?"#FEF2F205":"transparent"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:"#94A3B8",fontSize:11}}>{shipCol?"▸":"▾"}</span>
                  <h4 style={{fontSize:13,fontWeight:700}}>🚢 {ship.nome}</h4>
                  <span style={{fontSize:10,color:"#64748B"}}>{ship.pol}→{ship.pod}</span>
                  <span style={{padding:"1px 6px",borderRadius:8,background:`${col}10`,color:col,fontSize:9,fontWeight:600}}>{ship.bookings.length} bkg</span>
                  {ddlAlert&&<span style={{padding:"1px 6px",borderRadius:8,background:"#DC2626",color:"#fff",fontSize:9,fontWeight:700,animation:"pulse 1.5s ease infinite"}}>⏰ DDL {sDdl}d</span>}
                </div>
                <span style={{fontSize:10,color:"#64748B"}}>{ship.qtdTotal}T/{ship.qtdUsando}U/<span style={{color:sobra>0?"#047857":"#DC2626"}}>{sobra}S</span></span>
              </div>
              {!shipCol&&<div style={{padding:"0 16px 16px"}}>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  <button onClick={e=>{e.stopPropagation();setAddBkgTo(ship)}} style={{padding:"4px 10px",borderRadius:5,border:`1px solid ${col}30`,background:`${col}08`,color:col,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Booking</button>
                  <button onClick={e=>{e.stopPropagation();setEditShip(ship)}} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #E2E8F0",background:"#fff",color:BRAND,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✏️ Editar</button>
                  <button onClick={e=>{e.stopPropagation();delShip(ship.id)}} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🗑 Excluir</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:8}}>
                  <div style={{padding:6,borderRadius:6,background:"#F0FDFA",textAlign:"center"}}><p style={{fontSize:8,color:"#94A3B8",textTransform:"uppercase"}}>Saída</p><p style={{fontSize:11,fontWeight:600,color:"#0F766E"}}>{fD(ship.previsaoSaida)}</p></div>
                  <div style={{padding:6,borderRadius:6,background:"#FEF2F2",textAlign:"center"}}><p style={{fontSize:8,color:"#94A3B8",textTransform:"uppercase"}}>Cancelamento</p><p style={{fontSize:11,fontWeight:600,color:"#DC2626"}}>{fD(ship.dataCancelamento)}</p></div>
                  <div style={{padding:6,borderRadius:6,background:"#DBEAFE",textAlign:"center"}}><p style={{fontSize:8,color:"#94A3B8",textTransform:"uppercase"}}>Total</p><p style={{fontSize:14,fontWeight:700,color:"#1D4ED8"}}>{ship.qtdTotal}</p></div>
                  <div style={{padding:6,borderRadius:6,background:"#FEF3C7",textAlign:"center"}}><p style={{fontSize:8,color:"#94A3B8",textTransform:"uppercase"}}>Usando</p><p style={{fontSize:14,fontWeight:700,color:"#B45309"}}>{ship.qtdUsando}</p></div>
                  <div style={{padding:6,borderRadius:6,background:sobra>0?"#D1FAE5":"#FEF2F2",textAlign:"center"}}><p style={{fontSize:8,color:"#94A3B8",textTransform:"uppercase"}}>Sobrando</p><p style={{fontSize:14,fontWeight:700,color:sobra>0?"#047857":"#DC2626"}}>{sobra}</p></div>
                </div>
                {ship.cliente&&<p style={{fontSize:11,color:"#1D4ED8",marginBottom:4}}>Cliente: {ship.cliente}</p>}
                {ship.observation&&<p style={{fontSize:11,color:"#64748B",padding:"4px 8px",background:"#FFFBEB",borderRadius:4,marginBottom:6}}>📝 {ship.observation}</p>}
                {ship.bookings.length>0&&<div style={{marginTop:8}}>
                  <p style={{fontSize:10,fontWeight:600,color:"#94A3B8",textTransform:"uppercase",marginBottom:6}}>Bookings ({ship.bookings.length})</p>
                  {ship.bookings.map(b=>{const bD=b.deadlineCarga?dUntil(b.deadlineCarga):null;const bA=armCfg?.ddlDays>0&&bD!==null&&bD<=armCfg.ddlDays&&bD>=0;
                    return(<div key={b.id} style={{padding:"10px 12px",borderRadius:8,background:bA?"#FEF2F2":`${col}04`,border:`1px solid ${bA?"#FECACA":`${col}12`}`,marginBottom:4}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                            <span style={{fontSize:12,fontWeight:700,color:col}}>{b.bookingNumber||"Sem nº"}</span>
                            <span style={{fontSize:11,fontWeight:600}}>{b.client}</span>
                            {b.clientRef&&<span style={{fontSize:9,color:"#94A3B8"}}>({b.clientRef})</span>}
                            {bA&&<span style={{padding:"1px 6px",borderRadius:8,background:"#DC2626",color:"#fff",fontSize:8,fontWeight:700,animation:"pulse 1.5s ease infinite"}}>DDL {bD}d!</span>}
                          </div>
                          <p style={{fontSize:10,color:"#64748B"}}>{b.equipQty}x {b.equipType} · {b.pol||ship.pol}→{b.pod||ship.pod}{b.deadlineCarga?` · DDL: ${fD(b.deadlineCarga)}`:""}{b.reservas?` · Res: ${b.reservas}`:""}</p>
                          {b.observation&&<p style={{fontSize:10,color:"#94A3B8",marginTop:2}}>📝 {b.observation}</p>}
                        </div>
                        <button onClick={()=>delBkg(ship.id,b.id)} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:14,padding:"0 4px"}} title="Excluir">✕</button>
                      </div>
                    </div>)})}
                </div>}
              </div>}
            </div>)})}
        </div>}
      </div>)})}
    {arms.filter(a=>!grouped[a]?.length).length>0&&<p style={{color:"#CBD5E1",fontSize:11,textAlign:"center",marginTop:8}}>Sem navios: {arms.filter(a=>!grouped[a]?.length).join(", ")}</p>}
    {showNew&&<ShipModal onClose={()=>setShowNew(false)} onSave={f=>{setShips(prev=>[{id:`NV-${Date.now()}`,bookings:[],...f,createdBy:user.name,createdAt:Date.now()},...prev]);setShowNew(false)}} armadores={armadores}/>}
    {editShip&&<ShipModal onClose={()=>setEditShip(null)} onSave={f=>{setShips(prev=>prev.map(s=>s.id===editShip.id?{...s,...f}:s));setEditShip(null)}} armadores={armadores} initial={editShip}/>}
    {addBkgTo&&<AddShipBookingModal onClose={()=>setAddBkgTo(null)} onSave={f=>{setShips(prev=>prev.map(s=>s.id===addBkgTo.id?{...s,bookings:[...s.bookings,{id:`SBK-${Date.now()}`,createdAt:Date.now(),...f}]}:s));setAddBkgTo(null)}} ship={addBkgTo}/>}
  </div>);
}

// ═════════════════════════════════════════════
// MAIN — Supabase realtime + fallback local
// ═════════════════════════════════════════════
export default function App(){
  const[user,setUser]=useState(null);const[tab,setTab]=useState("bookings");const[loaded,setLoaded]=useState(false);
  const[bookings,setBookings]=useState([]);const[pendencias,setPendencias]=useState([]);const[ships,setShips]=useState([]);
  const[users,setUsers]=useState(USR_DEF);const[armadores,setArmadores]=useState(ARM_DEF);const[logo,setLogo]=useState(null);
  const[showUsers,setShowUsers]=useState(false);const[showArm,setShowArm]=useState(false);const[showLogo,setShowLogo]=useState(false);
  const[refreshing,setRefreshing]=useState(false);const[online,setOnline]=useState(!!supabase);
  const savingRef=useRef(false);

  const applyState=useCallback((d)=>{
    if(d.bookings)setBookings(d.bookings);
    if(d.pendencias)setPendencias(d.pendencias);
    if(d.ships)setShips(d.ships);
    const merged=[...(d.users||[])];
    USR_DEF.forEach(def=>{if(!merged.find(u=>u.username===def.username))merged.push(def)});
    setUsers(merged);
    if(d.armadores?.length)setArmadores(d.armadores);
    if(d.logo!==undefined)setLogo(d.logo);
  },[]);

  // LOAD
  useEffect(()=>{(async()=>{
    if(supabase){
      const d=await loadState();
      if(d&&Object.keys(d).length>0)applyState(d);
      setOnline(true);
    }else{
      try{const raw=localStorage.getItem("booking-control-data");if(raw)applyState(JSON.parse(raw))}catch{}
    }
    setLoaded(true);
  })()},[applyState]);

  // SAVE on any change
  useEffect(()=>{
    if(!loaded||savingRef.current)return;
    const state={bookings,pendencias,ships,users,armadores,logo};
    savingRef.current=true;
    if(supabase){
      saveState(state,user?.name).finally(()=>{savingRef.current=false});
    }else{
      try{localStorage.setItem("booking-control-data",JSON.stringify(state))}catch{}
      savingRef.current=false;
    }
  },[bookings,pendencias,ships,users,armadores,logo,loaded]);

  // REALTIME subscription
  useEffect(()=>{
    if(!supabase)return;
    const unsub=subscribeToChanges((newData)=>{
      if(!savingRef.current)applyState(newData);
    });
    return unsub;
  },[applyState]);

  const refresh=async()=>{
    setRefreshing(true);
    if(supabase){const d=await loadState();if(d)applyState(d)}
    setTimeout(()=>setRefreshing(false),500);
  };

  if(!user)return<Login onLogin={setUser} users={users} logo={logo}/>;
  const at=TABS.find(t=>t.id===tab);

  return(
    <div style={{minHeight:"100vh",background:"#F8F9FB",fontFamily:"'Inter',sans-serif",color:"#1E293B"}}>
      <style>{CSS}</style>
      <header style={{padding:"10px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #E2E8F0",background:"#fff",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {logo?<img src={logo} alt="Logo" style={{maxHeight:36,maxWidth:140}} onClick={()=>setShowLogo(true)}/>:
          <div onClick={()=>setShowLogo(true)} style={{width:36,height:36,borderRadius:9,background:BRAND,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}><span>IS</span></div>}
          <div><h1 style={{fontSize:14,fontWeight:700,color:BRAND}}>Inter Shipping</h1><p style={{fontSize:9,color:"#94A3B8"}}>Booking Control{online?" · 🟢 Online":" · 🟡 Local"}</p></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={refresh} style={{...bG,padding:"6px 10px",fontSize:11,display:"flex",alignItems:"center",gap:4}}><span style={{display:"inline-block",animation:refreshing?"spin .6s linear infinite":"none",fontSize:12}}>🔄</span></button>
          {user.role==="gerencia"&&<button onClick={()=>setShowUsers(true)} style={{...bG,padding:"6px 10px",fontSize:11}}>👥</button>}
          <button onClick={()=>setShowArm(true)} style={{...bG,padding:"6px 10px",fontSize:11}}>⚓</button>
          <button onClick={()=>setShowLogo(true)} style={{...bG,padding:"6px 10px",fontSize:11}}>📷</button>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:28,height:28,borderRadius:7,background:user.role==="gerencia"?"#FEF3C7":"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>{user.role==="gerencia"?"👑":"👤"}</div>
            <p style={{fontSize:11,fontWeight:600}}>{user.name}</p>
          </div>
          <button onClick={()=>setUser(null)} style={{padding:"4px 10px",borderRadius:5,border:"1px solid #E2E8F0",background:"#fff",color:"#94A3B8",fontSize:9,cursor:"pointer"}}>Sair</button>
        </div>
      </header>
      <div style={{padding:"12px 24px 0",background:"#fff",borderBottom:"1px solid #E2E8F0",display:"flex",gap:4}}>
        {TABS.map(t=>{const a=tab===t.id;return(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 20px",borderRadius:"8px 8px 0 0",border:a?`2px solid ${t.c}`:"2px solid transparent",borderBottom:a?"2px solid #fff":"2px solid transparent",background:a?t.bg:"transparent",color:a?t.c:"#94A3B8",fontSize:12,fontWeight:a?700:500,cursor:"pointer",fontFamily:"inherit",marginBottom:"-1px",display:"flex",alignItems:"center",gap:6}}><span>{t.icon}</span>{t.label}</button>)})}
      </div>
      <div style={{height:3,background:`linear-gradient(90deg,${at.c},${at.c}55)`}}/>
      <div style={{padding:"20px 24px",maxWidth:1440,margin:"0 auto"}}>
        <Notifications bookings={bookings} ships={ships} armadores={armadores}/>
        {tab==="bookings"&&<BookingsPanel data={bookings} setData={setBookings} armadores={armadores} user={user}/>}
        {tab==="pendencias"&&<PendenciasPanel data={pendencias} setData={setPendencias} user={user}/>}
        {tab==="standby"&&<StandbyPanel ships={ships} setShips={setShips} armadores={armadores} user={user}/>}
      </div>
      {showUsers&&<UserManager users={users} onSave={l=>{setUsers(l);setShowUsers(false)}} onClose={()=>setShowUsers(false)}/>}
      {showArm&&<ArmadorManager armadores={armadores} onSave={l=>{setArmadores(l);setShowArm(false)}} onClose={()=>setShowArm(false)}/>}
      {showLogo&&<LogoManager logo={logo} onSave={l=>{setLogo(l);setShowLogo(false)}} onClose={()=>setShowLogo(false)}/>}
    </div>
  );
}
