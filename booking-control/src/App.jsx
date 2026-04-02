import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { loadState, saveState, subscribeToChanges, supabase } from "./lib/db.js";

const SLA_MS=2*3600000,URGENT_MS=30*60000,THREE_DAYS=3*24*3600000,FIVE_DAYS=5*24*3600000,TWO_DAYS=2*24*3600000;
const BRAND="#0F4C81",BRAND_LT="#E8F0F8";
const RU_PORTS=["saint petersburg","st petersburg","st. petersburg","novorossiysk"];
const isRuPort=r=>{try{const p=((r?.pol||"")+(r?.pod||"")).toLowerCase();return RU_PORTS.some(rp=>p.includes(rp))}catch{return false}};
const getSLA=r=>isRuPort(r)?24*3600000:2*3600000;
const ST={
  Solicitado:{c:"#B45309",bg:"#FEF3C7",bd:"#FDE68A",i:"⏳"},
  "Precisando de estratégia":{c:"#1D4ED8",bg:"#DBEAFE",bd:"#BFDBFE",i:"🧠"},
  "Aguardando contrato":{c:"#7C3AED",bg:"#EDE9FE",bd:"#DDD6FE",i:"📄"},
  Aprovado:{c:"#047857",bg:"#D1FAE5",bd:"#A7F3D0",i:"✅"},
  Cancelado:{c:"#DC2626",bg:"#FEE2E2",bd:"#FECACA",i:"🚫"},
  "Enviado ao cliente":{c:"#0369A1",bg:"#E0F2FE",bd:"#BAE6FD",i:"📤"},
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
  {id:"lixeira",label:"Lixeira",icon:"🗑",c:"#64748B",bg:"#F8FAFC"},
];
const AClr={"MSC":"#1D4ED8","Maersk":"#0F766E","CMA CGM":"#B45309","Hapag-Lloyd":"#DC2626","COSCO":"#7C3AED","Evergreen":"#047857","ONE":"#BE185D","HMM":"#0369A1","Yang Ming":"#A16207","ZIM":"#6D28D9"};
const aC=a=>AClr[a]||"#475569";
const fT=ms=>{if(ms<=0)return"00:00:00";const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);return`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`};
const fD=ts=>ts?new Date(ts).toLocaleDateString("pt-BR"):"—";
const fDt=ts=>new Date(ts).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
const isEsc=r=>{try{return(r.status==="Solicitado"||r.status==="Precisando de estratégia")&&(Date.now()-(r.createdAt||0))>getSLA(r)}catch{return false}};
const isUrg=r=>!!r.isUrgent;
const slaR=r=>{try{if(!r||r.status==="Aprovado"||r.status==="Aguardando contrato"||r.status==="Cancelado"||r.status==="Enviado ao cliente")return null;return getSLA(r)-(Date.now()-(r.createdAt||0))}catch{return null}};
const isExp=r=>r.status==="Aprovado"&&(Date.now()-r.updatedAt)>THREE_DAYS;
const isEnvExp=r=>r.status==="Enviado ao cliente"&&(Date.now()-r.updatedAt)>TWO_DAYS;
const isTrashed=r=>!!r.deletedAt;
const isTrashExp=r=>r.deletedAt&&(Date.now()-r.deletedAt)>FIVE_DAYS;
const A=v=>Array.isArray(v)?v:[];
const armN=a=>typeof a==="string"?a:(a?.name||"");
const armD=a=>typeof a==="object"?(a?.ddlDays||0):0;
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

class ErrorBoundary extends React.Component{constructor(p){super(p);this.state={err:null}}static getDerivedStateFromError(e){return{err:e}}render(){if(this.state.err)return(<div style={{padding:40,textAlign:"center",fontFamily:"Inter,sans-serif"}}><h2 style={{color:"#DC2626",marginBottom:12}}>Erro no sistema</h2><p style={{color:"#64748B",marginBottom:8}}>{String(this.state.err?.message||"")}</p><button onClick={()=>{try{localStorage.removeItem("booking-control-data")}catch{};window.location.reload()}} style={{padding:"9px 20px",borderRadius:8,border:"none",background:"#DC2626",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Limpar e recarregar</button></div>);return this.props.children}}

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
  const[f,setF]=useState({client:"",clientRef:"",subject:"",emailSubject:"",bookingNumber:"",equipQty:1,equipType:EQ[0],pol:"",pod:"",armador:arms[0]||"",navio:"",dataSaida:"",isUrgent:false,urgentNote:""});
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
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>🚢 Nome do Navio</label><input value={f.navio} onChange={e=>s("navio",e.target.value)} placeholder="Ex: MSC Fantasia" style={iS}/></div>
      <div><label style={lS}>📅 Data de Saída</label><input type="date" value={f.dataSaida} onChange={e=>s("dataSaida",e.target.value)} style={iS}/></div>
    </div>
    <div style={{marginBottom:18,padding:12,borderRadius:8,background:"#FEF2F2",border:"1px solid #FECACA"}}>
      <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:f.isUrgent?8:0}}><input type="checkbox" checked={f.isUrgent} onChange={e=>s("isUrgent",e.target.checked)} style={{width:16,height:16,accentColor:"#DC2626"}}/><span style={{color:"#DC2626",fontSize:13,fontWeight:600}}>🔴 URGENTE</span></label>
      {f.isUrgent&&<input value={f.urgentNote} onChange={e=>s("urgentNote",e.target.value)} placeholder="Motivo..." style={{...iS,border:"1px solid #FECACA"}}/>}
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>ok&&onSave(f)} style={{...bP,opacity:ok?1:.5}}>Criar</button></div>
  </Modal>);
}

function BookingDetail({req,onClose,onChangeStatus,onUpdate,onDelete,user}){
  const[obsText,setObsText]=useState("");
  const[editing,setEditing]=useState(false);
  const[ef,setEf]=useState({client:req.client||"",clientRef:req.clientRef||"",subject:req.subject||"",emailSubject:req.emailSubject||"",bookingNumber:req.bookingNumber||"",equipQty:req.equipQty||1,equipType:req.equipType||EQ[0],pol:req.pol||"",pod:req.pod||"",armador:req.armador||"",navio:req.navio||"",dataSaida:req.dataSaida?String(req.dataSaida).split("T")[0]:"",isUrgent:!!req.isUrgent,urgentNote:req.urgentNote||""});
  const es=(k,v)=>setEf(p=>({...p,[k]:v}));
  const saveEdit=()=>{onUpdate(req.id,{...ef,dataSaida:ef.dataSaida||""});setEditing(false)};
  const addObs=()=>{if(!obsText.trim())return;onUpdate(req.id,{observations:[...(req.observations||[]),{text:obsText.trim(),by:user.name,at:Date.now()}]});setObsText("")};
  return(<Modal onClose={onClose} wide>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
      <div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
          <span style={{color:"#94A3B8",fontSize:12,fontWeight:600}}>{req.id}</span>
          <span style={{padding:"2px 8px",borderRadius:16,fontSize:10,fontWeight:600,background:ST[req.status]?.bg,color:ST[req.status]?.c}}>{ST[req.status]?.i} {req.status}</span>
          {req.isUrgent&&<span style={{background:"#FEF2F2",color:"#DC2626",padding:"2px 8px",borderRadius:16,fontSize:10,fontWeight:700}}>🔴 URGENTE</span>}
        </div>
        <h2 style={{fontSize:16,fontWeight:700}}>{editing?ef.subject:req.subject}</h2>
        {req.isUrgent&&req.urgentNote&&!editing&&<p style={{color:"#DC2626",fontSize:11,marginTop:2}}>Motivo: {req.urgentNote}</p>}
      </div>
      <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
        {!editing&&<button onClick={()=>setEditing(true)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${BRAND}30`,background:`${BRAND}08`,color:BRAND,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✏️ Editar</button>}
        <button onClick={onClose} style={{background:"none",border:"none",color:"#94A3B8",fontSize:18,cursor:"pointer"}}>✕</button>
      </div>
    </div>
    {editing?<div style={{padding:16,borderRadius:10,background:"#F8FAFC",border:"1px solid #E2E8F0",marginBottom:12}}>
      <p style={{color:BRAND,fontSize:11,fontWeight:700,textTransform:"uppercase",marginBottom:12}}>Editar Dados do Booking</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={lS}>Cliente</label><input value={ef.client} onChange={e=>es("client",e.target.value)} style={iS}/></div>
        <div><label style={lS}>Referência</label><input value={ef.clientRef} onChange={e=>es("clientRef",e.target.value)} style={iS}/></div>
      </div>
      <div style={{marginBottom:10}}><label style={lS}>Assunto</label><input value={ef.subject} onChange={e=>es("subject",e.target.value)} style={iS}/></div>
      <div style={{marginBottom:10}}><label style={lS}>E-mail</label><input value={ef.emailSubject} onChange={e=>es("emailSubject",e.target.value)} style={iS}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={lS}>Nº Booking</label><input value={ef.bookingNumber} onChange={e=>es("bookingNumber",e.target.value)} style={iS}/></div>
        <div><label style={lS}>Armador</label><input value={ef.armador} onChange={e=>es("armador",e.target.value)} style={iS}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:10,marginBottom:10}}>
        <div><label style={lS}>Qtd</label><input type="number" min={1} value={ef.equipQty} onChange={e=>es("equipQty",Math.max(1,parseInt(e.target.value)||1))} style={iS}/></div>
        <div><label style={lS}>Equipamento</label><select value={ef.equipType} onChange={e=>es("equipType",e.target.value)} style={selS}>{EQ.map(t=><option key={t}>{t}</option>)}</select></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={lS}>POL</label><input value={ef.pol} onChange={e=>es("pol",e.target.value)} style={iS}/></div>
        <div><label style={lS}>POD</label><input value={ef.pod} onChange={e=>es("pod",e.target.value)} style={iS}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <div><label style={lS}>Navio</label><input value={ef.navio} onChange={e=>es("navio",e.target.value)} style={iS}/></div>
        <div><label style={lS}>Data de Saída</label><input type="date" value={ef.dataSaida} onChange={e=>es("dataSaida",e.target.value)} style={iS}/></div>
      </div>
      <div style={{marginBottom:10,padding:10,borderRadius:8,background:"#FEF2F2",border:"1px solid #FECACA"}}>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:ef.isUrgent?8:0}}><input type="checkbox" checked={ef.isUrgent} onChange={e=>es("isUrgent",e.target.checked)} style={{width:16,height:16,accentColor:"#DC2626"}}/><span style={{color:"#DC2626",fontSize:13,fontWeight:600}}>🔴 URGENTE</span></label>
        {ef.isUrgent&&<input value={ef.urgentNote} onChange={e=>es("urgentNote",e.target.value)} placeholder="Motivo..." style={{...iS,border:"1px solid #FECACA"}}/>}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={()=>setEditing(false)} style={{...bG,fontSize:12}}>Cancelar</button>
        <button onClick={saveEdit} style={{...bP,fontSize:12}}>Salvar Alterações</button>
      </div>
    </div>:<>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:8}}>
      {[["Cliente",req.client],["Ref.",req.clientRef],["Booking",req.bookingNumber||"Pendente"],["Equip.",`${req.equipQty}x ${req.equipType}`],["Armador",req.armador],["E-mail",req.emailSubject],["Navio",req.navio],["Saída",req.dataSaida?fD(req.dataSaida):null]].map(([l,v],i)=><div key={i} style={{padding:"7px 10px",borderRadius:6,background:"#F8FAFC"}}><p style={{color:"#94A3B8",fontSize:9,textTransform:"uppercase"}}>{l}</p><p style={{color:"#334155",fontSize:12,fontWeight:500}}>{v||"—"}</p></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
      <div style={{padding:"7px 10px",borderRadius:6,background:"#EFF6FF"}}><p style={{color:"#94A3B8",fontSize:9}}>POL</p><p style={{color:"#1D4ED8",fontSize:13,fontWeight:600}}>🚢 {req.pol}</p></div>
      <div style={{padding:"7px 10px",borderRadius:6,background:"#ECFDF5"}}><p style={{color:"#94A3B8",fontSize:9}}>POD</p><p style={{color:"#047857",fontSize:13,fontWeight:600}}>📍 {req.pod}</p></div>
    </div>
    </>}
    {req.history?.length>0&&<div style={{marginBottom:8}}><p style={lS}>Histórico</p><div style={{background:"#F8FAFC",borderRadius:6,padding:6}}>{req.history.map((h,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",fontSize:10,color:"#64748B"}}><span style={{fontWeight:600,minWidth:85}}>{fDt(h.at)}</span><span style={{padding:"1px 6px",borderRadius:10,background:ST[h.from]?.bg,color:ST[h.from]?.c,fontSize:9}}>{h.from}</span>→<span style={{padding:"1px 6px",borderRadius:10,background:ST[h.to]?.bg,color:ST[h.to]?.c,fontSize:9}}>{h.to}</span><span>{h.by}</span></div>)}</div></div>}
    <div style={{marginBottom:10}}><p style={lS}>Observações</p>
      {(req.observations||[]).map((o,i)=><div key={i} style={{padding:"6px 10px",borderRadius:6,background:"#FFFBEB",border:"1px solid #FEF3C7",marginBottom:3}}><p style={{fontSize:12}}>{o.text}</p><p style={{fontSize:9,color:"#94A3B8",marginTop:1}}>{o.by} · {fDt(o.at)}</p></div>)}
      <div style={{display:"flex",gap:6}}><input value={obsText} onChange={e=>setObsText(e.target.value)} placeholder="Observação..." style={{...iS,flex:1}} onKeyDown={e=>{if(e.key==="Enter")addObs()}}/><button onClick={addObs} style={{...bP,padding:"8px 14px",fontSize:11}}>Enviar</button></div>
    </div>
    {req.status!=="Cancelado"&&req.status!=="Enviado ao cliente"&&<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {req.status==="Aprovado"
        ?<button onClick={()=>onChangeStatus(req.id,"Enviado ao cliente")} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #BAE6FD",background:"#E0F2FE",color:"#0369A1",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>📤 Enviar ao Cliente</button>
        :Object.keys(ST).filter(s=>s!==req.status).map(s=><button key={s} onClick={()=>onChangeStatus(req.id,s)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${ST[s].bd}`,background:ST[s].bg,color:ST[s].c,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{ST[s].i} {s}</button>)
      }
    </div>}
    <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #F1F5F9",display:"flex",justifyContent:"flex-end"}}>
      <button onClick={()=>{if(window.confirm("Mover este processo para a lixeira?"))onDelete(req.id)}} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🗑 Excluir Processo</button>
    </div>
  </Modal>);
}

function PendenciaModal({onClose,onSave,initial}){
  const[bn,setBn]=useState(initial?.bookingNumber||"");const[obs,setObs]=useState(initial?.observation||"");
  return(<Modal onClose={onClose}><h2 style={{color:"#B45309",fontSize:16,fontWeight:700,marginBottom:16}}>{initial?"Editar":"Nova"} Pendência</h2>
    <div style={{marginBottom:12}}><label style={lS}>Nº do Booking *</label><input value={bn} onChange={e=>setBn(e.target.value)} style={iS}/></div>
    <div style={{marginBottom:16}}><label style={lS}>O que está pendente? *</label><textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3} style={{...iS,resize:"vertical"}}/></div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>{if(bn&&obs)onSave({bookingNumber:bn,observation:obs})}} style={{...bP,background:"#B45309",opacity:bn&&obs?1:.5}}>Adicionar</button></div>
  </Modal>);
}

function ShipModal({onClose,onSave,armadores,initial,onAddArmador}){
  const arms=armadores.map(a=>a.name);
  const d=initial||{nome:"",armador:arms[0]||"",pol:"",pod:"",previsaoSaida:"",dataCancelamento:""};
  const[f,setF]=useState({nome:d.nome||"",armador:d.armador||arms[0]||"",pol:d.pol||"",pod:d.pod||"",previsaoSaida:d.previsaoSaida?String(d.previsaoSaida).split("T")[0]:"",dataCancelamento:d.dataCancelamento?String(d.dataCancelamento).split("T")[0]:""});
  const[newArmMode,setNewArmMode]=useState(false);
  const[newArmName,setNewArmName]=useState("");
  const[newArmDdl,setNewArmDdl]=useState(0);
  const s=(k,v)=>setF(p=>({...p,[k]:v}));const ok=f.nome&&f.armador&&f.pol&&f.pod;
  const addArm=()=>{
    const name=newArmName.trim();
    if(!name||arms.includes(name))return;
    if(onAddArmador)onAddArmador({name,ddlDays:newArmDdl});
    s("armador",name);setNewArmMode(false);setNewArmName("");setNewArmDdl(0);
  };
  return(<Modal onClose={onClose}>
    <h2 style={{color:"#0F766E",fontSize:16,fontWeight:700,marginBottom:4}}>{initial?"Editar Navio":"Cadastrar Navio"}</h2>
    <p style={{color:"#94A3B8",fontSize:11,marginBottom:20}}>Dados do navio e datas de controle. Bookings serão adicionados depois.</p>
    <div style={{marginBottom:12}}><label style={lS}>Nome do Navio *</label><input value={f.nome} onChange={e=>s("nome",e.target.value)} placeholder="Ex: MSC Fantasia" style={iS}/></div>
    <div style={{marginBottom:12}}>
      <label style={lS}>Armador *</label>
      {!newArmMode?<div style={{display:"flex",gap:6}}>
        <select value={f.armador} onChange={e=>s("armador",e.target.value)} style={{...selS,flex:1}}>{[...arms,...(f.armador&&!arms.includes(f.armador)?[f.armador]:[])].map(a=><option key={a}>{a}</option>)}</select>
        <button onClick={()=>setNewArmMode(true)} style={{padding:"8px 14px",borderRadius:8,border:"1px solid #99F6E4",background:"#F0FDFA",color:"#0F766E",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>+ Novo</button>
      </div>:<div style={{padding:12,borderRadius:8,background:"#F0FDFA",border:"1px solid #99F6E4"}}>
        <p style={{color:"#0F766E",fontSize:10,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Novo Armador</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px",gap:8,marginBottom:8}}>
          <div><label style={{...lS,fontSize:9}}>Nome *</label><input value={newArmName} onChange={e=>setNewArmName(e.target.value)} placeholder="Ex: PIL" style={iS} onKeyDown={e=>e.key==="Enter"&&addArm()}/></div>
          <div><label style={{...lS,fontSize:9}}>DDL (dias)</label><input type="number" min={0} value={newArmDdl} onChange={e=>setNewArmDdl(parseInt(e.target.value)||0)} style={iS}/></div>
        </div>
        <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
          <button onClick={()=>{setNewArmMode(false);setNewArmName("")}} style={{...bG,fontSize:10,padding:"5px 10px"}}>Cancelar</button>
          <button onClick={addArm} style={{padding:"5px 14px",borderRadius:6,border:"none",background:"#0F766E",color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:newArmName.trim()?1:.5}}>Criar Armador</button>
        </div>
      </div>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>POL *</label><input value={f.pol} onChange={e=>s("pol",e.target.value)} placeholder="Santos" style={iS}/></div>
      <div><label style={lS}>POD *</label><input value={f.pod} onChange={e=>s("pod",e.target.value)} placeholder="Roterdã" style={iS}/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
      <div><label style={lS}>🚢 Data de Saída</label><input type="date" value={f.previsaoSaida} onChange={e=>s("previsaoSaida",e.target.value)} style={iS}/></div>
      <div><label style={lS}>❌ Data de Cancelamento</label><input type="date" value={f.dataCancelamento} onChange={e=>s("dataCancelamento",e.target.value)} style={iS}/></div>
    </div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>ok&&onSave(f)} style={{...bP,background:"#0F766E",opacity:ok?1:.5}}>Salvar</button></div>
  </Modal>);
}

// ─── ADD BOOKING TO SHIP — campos do primeiro + deadline de carga ───
function AddShipBookingModal({onClose,onSave,ship}){
  const bkgs=ship.bookings||[];const first=bkgs[0];
  const[f,setF]=useState({
    bookingNumber:"",
    client:first?.client||ship.cliente||"",
    clientRef:first?.clientRef||"",
    pol:first?.pol||ship.pol||"",
    pod:first?.pod||ship.pod||"",
    deadlineCarga:"",
    qtdTotal:first?.qtdTotal||0,
    qtdUsando:first?.qtdUsando||0,
    equipQty:first?.equipQty||1,
    equipType:first?.equipType||EQ[0],
    reservas:first?.reservas||ship.reservas||"",
    observation:""
  });
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const sobra=f.qtdTotal-f.qtdUsando;
  return(<Modal onClose={onClose} wide>
    <h2 style={{color:"#0F766E",fontSize:16,fontWeight:700,marginBottom:4}}>Booking no Navio {ship.nome}</h2>
    <p style={{color:"#64748B",fontSize:11,marginBottom:4}}>Armador: <strong style={{color:aC(ship.armador)}}>{ship.armador}</strong> · Saída: <strong>{fD(ship.previsaoSaida)}</strong>{first?" · Dados pré-preenchidos do 1º booking":""}</p>
    <p style={{color:"#94A3B8",fontSize:10,marginBottom:16}}>A data de saída segue a do navio. Preencha o Deadline de Carga deste booking.</p>

    {/* Nº Booking + Cliente (como na tela do navio: Nome + Armador) */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Nº Booking *</label><input value={f.bookingNumber} onChange={e=>s("bookingNumber",e.target.value)} placeholder="Ex: MSCU1234567" style={iS}/></div>
      <div><label style={lS}>Cliente *</label><input value={f.client} onChange={e=>s("client",e.target.value)} style={iS}/></div>
    </div>

    {/* Referência */}
    <div style={{marginBottom:12}}>
      <label style={lS}>Referência do Cliente</label>
      <input value={f.clientRef} onChange={e=>s("clientRef",e.target.value)} style={iS}/>
    </div>

    {/* POL + POD */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>POL *</label><input value={f.pol} onChange={e=>s("pol",e.target.value)} style={iS}/></div>
      <div><label style={lS}>POD *</label><input value={f.pod} onChange={e=>s("pod",e.target.value)} style={iS}/></div>
    </div>

    {/* Deadline de Carga (substitui Cancelamento Reserva) */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div style={{padding:12,borderRadius:8,background:"#FEF2F2",border:"1px solid #FECACA"}}>
        <label style={{...lS,color:"#DC2626"}}>⏰ Deadline de Carga *</label>
        <input type="date" value={f.deadlineCarga} onChange={e=>s("deadlineCarga",e.target.value)} style={{...iS,border:"1px solid #FECACA"}}/>
      </div>
      <div style={{padding:12,borderRadius:8,background:"#F0FDFA",border:"1px solid #99F6E4"}}>
        <label style={{...lS,color:"#0F766E"}}>🚢 Saída do Navio (referência)</label>
        <p style={{fontSize:14,fontWeight:700,color:"#0F766E",padding:"9px 0"}}>{fD(ship.previsaoSaida)}</p>
      </div>
    </div>

    {/* Qtd Total + Usando + Sobrando */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Qtd Total</label><input type="number" min={0} value={f.qtdTotal} onChange={e=>s("qtdTotal",parseInt(e.target.value)||0)} style={iS}/></div>
      <div><label style={lS}>Usando</label><input type="number" min={0} value={f.qtdUsando} onChange={e=>s("qtdUsando",parseInt(e.target.value)||0)} style={iS}/></div>
      <div style={{padding:8,borderRadius:6,background:sobra>0?"#D1FAE5":"#FEF2F2",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}><p style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase"}}>Sobrando</p><p style={{fontSize:18,fontWeight:700,color:sobra>0?"#047857":"#DC2626"}}>{sobra}</p></div>
    </div>

    {/* Equipamento */}
    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Qtd Equip.</label><input type="number" min={1} value={f.equipQty} onChange={e=>s("equipQty",Math.max(1,parseInt(e.target.value)||1))} style={iS}/></div>
      <div><label style={lS}>Tipo de Equipamento</label><select value={f.equipType} onChange={e=>s("equipType",e.target.value)} style={selS}>{EQ.map(t=><option key={t}>{t}</option>)}</select></div>
    </div>

    {/* Reservas + Observações */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Reservas</label><input value={f.reservas} onChange={e=>s("reservas",e.target.value)} style={iS}/></div>
    </div>
    <div style={{marginBottom:16}}><label style={lS}>Observações</label><textarea value={f.observation} onChange={e=>s("observation",e.target.value)} rows={2} style={{...iS,resize:"vertical"}}/></div>

    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>onSave(f)} style={{...bP,background:"#0F766E"}}>Adicionar Booking</button></div>
  </Modal>);
}

function EditShipBookingModal({onClose,onSave,ship,booking}){
  const[f,setF]=useState({
    bookingNumber:booking.bookingNumber||"",
    client:booking.client||"",
    clientRef:booking.clientRef||"",
    pol:booking.pol||ship.pol||"",
    pod:booking.pod||ship.pod||"",
    deadlineCarga:booking.deadlineCarga?String(booking.deadlineCarga).split("T")[0]:"",
    qtdTotal:booking.qtdTotal||booking.qtdDisponivel||0,
    qtdUsando:booking.qtdUsando||0,
    equipQty:booking.equipQty||1,
    equipType:booking.equipType||EQ[0],
    reservas:booking.reservas||"",
    observation:booking.observation||""
  });
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const sobra=f.qtdTotal-f.qtdUsando;
  return(<Modal onClose={onClose} wide>
    <h2 style={{color:"#0F766E",fontSize:16,fontWeight:700,marginBottom:4}}>Editar Booking — {ship.nome}</h2>
    <p style={{color:"#64748B",fontSize:11,marginBottom:16}}>Armador: <strong style={{color:aC(ship.armador)}}>{ship.armador}</strong> · Saída: <strong>{fD(ship.previsaoSaida)}</strong></p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Nº Booking</label><input value={f.bookingNumber} onChange={e=>s("bookingNumber",e.target.value)} style={iS}/></div>
      <div><label style={lS}>Cliente</label><input value={f.client} onChange={e=>s("client",e.target.value)} style={iS}/></div>
    </div>
    <div style={{marginBottom:12}}><label style={lS}>Referência do Cliente</label><input value={f.clientRef} onChange={e=>s("clientRef",e.target.value)} style={iS}/></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>POL</label><input value={f.pol} onChange={e=>s("pol",e.target.value)} style={iS}/></div>
      <div><label style={lS}>POD</label><input value={f.pod} onChange={e=>s("pod",e.target.value)} style={iS}/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div style={{padding:12,borderRadius:8,background:"#FEF2F2",border:"1px solid #FECACA"}}><label style={{...lS,color:"#DC2626"}}>⏰ Deadline de Carga</label><input type="date" value={f.deadlineCarga} onChange={e=>s("deadlineCarga",e.target.value)} style={{...iS,border:"1px solid #FECACA"}}/></div>
      <div style={{padding:12,borderRadius:8,background:"#F0FDFA",border:"1px solid #99F6E4"}}><label style={{...lS,color:"#0F766E"}}>🚢 Saída do Navio</label><p style={{fontSize:14,fontWeight:700,color:"#0F766E",padding:"9px 0"}}>{fD(ship.previsaoSaida)}</p></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Qtd Total</label><input type="number" min={0} value={f.qtdTotal} onChange={e=>s("qtdTotal",parseInt(e.target.value)||0)} style={iS}/></div>
      <div><label style={lS}>Usando</label><input type="number" min={0} value={f.qtdUsando} onChange={e=>s("qtdUsando",parseInt(e.target.value)||0)} style={iS}/></div>
      <div style={{padding:8,borderRadius:6,background:sobra>0?"#D1FAE5":"#FEF2F2",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center"}}><p style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase"}}>Sobrando</p><p style={{fontSize:18,fontWeight:700,color:sobra>0?"#047857":"#DC2626"}}>{sobra}</p></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Qtd Equip.</label><input type="number" min={1} value={f.equipQty} onChange={e=>s("equipQty",Math.max(1,parseInt(e.target.value)||1))} style={iS}/></div>
      <div><label style={lS}>Tipo de Equipamento</label><select value={f.equipType} onChange={e=>s("equipType",e.target.value)} style={selS}>{EQ.map(t=><option key={t}>{t}</option>)}</select></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div><label style={lS}>Reservas</label><input value={f.reservas} onChange={e=>s("reservas",e.target.value)} style={iS}/></div>
    </div>
    <div style={{marginBottom:16}}><label style={lS}>Observações</label><textarea value={f.observation} onChange={e=>s("observation",e.target.value)} rows={2} style={{...iS,resize:"vertical"}}/></div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={onClose} style={bG}>Cancelar</button><button onClick={()=>onSave({...booking,...f,qtdDisponivel:f.qtdTotal})} style={{...bP,background:"#0F766E"}}>Salvar Alterações</button></div>
  </Modal>);
}

function Notifications({bookings,ships,armadores,notifPerm,onRequestPerm}){
  const[dismissed,setDismissed]=useState({});
  const notes=[];
  const esc=bookings.filter(r=>!isTrashed(r)).filter(isEsc);
  if(esc.length>0)notes.push({id:"sla",msg:`🚨 ${esc.length} booking(s) estourou(aram) o SLA de 2h!`,color:"#DC2626",bg:"#FEF2F2",bd:"#FECACA",critical:true});
  armadores.forEach(arm=>{
    if(arm.ddlDays<=0)return;
    ships.filter(s=>s.armador===arm.name).forEach(s=>{
      (s.bookings||[]).forEach(b=>{
        if(!b.deadlineCarga)return;
        const d=dUntil(b.deadlineCarga);
        if(d!==null&&d<=arm.ddlDays&&d>=0){
          const id=`ddl-${s.id}-${b.id}`;
          notes.push({id,msg:`⏰ ${arm.name} — "${s.nome}" BKG ${b.bookingNumber||"s/n"}: DDL carga em ${d}d! (${fD(b.deadlineCarga)})`,color:aC(arm.name),bg:"#FEF2F2",bd:"#FECACA",critical:d<=1});
        }
      });
      const dc=dUntil(s.dataCancelamento);
      if(dc!==null&&dc<=arm.ddlDays&&dc>=0){
        const id=`cancel-${s.id}`;
        notes.push({id,msg:`⚠️ ${arm.name} — "${s.nome}": Cancelamento reserva em ${dc}d! (${fD(s.dataCancelamento)})`,color:aC(arm.name),bg:"#FFF7ED",bd:"#FED7AA",critical:dc<=1});
      }
    });
  });
  const visible=notes.filter(n=>!dismissed[n.id]);
  if(!visible.length&&notifPerm==="granted")return null;
  return(<div style={{marginBottom:12}}>
    {/* Push notification permission banner */}
    {notifPerm&&notifPerm!=="granted"&&<div style={{padding:"10px 14px",borderRadius:10,background:"#EFF6FF",border:"1px solid #BFDBFE",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <p style={{color:"#1D4ED8",fontWeight:600,fontSize:12}}>🔔 Ative as notificações para receber alertas de DDL e cancelamento mesmo fora da aba</p>
      <button onClick={onRequestPerm} style={{padding:"5px 14px",borderRadius:6,border:"none",background:"#1D4ED8",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Ativar Notificações</button>
    </div>}
    {visible.map(n=><div key={n.id} style={{padding:"10px 14px",borderRadius:10,background:n.bg,border:`1px solid ${n.bd}`,marginBottom:6,animation:n.critical?"pulse 2s ease infinite":"slideIn .4s",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <p style={{color:n.color,fontWeight:700,fontSize:12}}>{n.msg}</p>
      <button onClick={()=>setDismissed(p=>({...p,[n.id]:true}))} style={{background:"none",border:"none",color:n.color,cursor:"pointer",fontSize:14,opacity:.5,padding:"0 4px"}}>✕</button>
    </div>)}
  </div>);
}

// ─── PANELS ─────────────────────────────────
function BookingsPanel({data,setData,armadores,user}){
  const[showNew,setShowNew]=useState(false);const[sel,setSel]=useState(null);const[filter,setFilter]=useState("Todos");const[tick,setTick]=useState(0);
  useEffect(()=>{const i=setInterval(()=>setTick(t=>t+1),1000);return()=>clearInterval(i)},[]);
  // Auto-purge: Aprovado after 3 days, Enviado ao cliente after 5 days, trashed after 5 days
  useEffect(()=>{
    const shouldClean=A(data).some(r=>isExp(r)||isEnvExp(r)||isTrashExp(r));
    if(shouldClean)setData(prev=>A(prev).filter(r=>!isExp(r)&&!isEnvExp(r)&&!isTrashExp(r)));
  },[data]);
  const active=A(data).filter(r=>!isTrashed(r));
  const escC=active.filter(isEsc).length,urgC=active.filter(isUrg).length;
  const filt=filter==="Todos"?active:filter==="Escalonados"?active.filter(isEsc):filter==="Urgentes"?active.filter(isUrg):active.filter(r=>r.status===filter);
  const addReq=f=>{setData(prev=>[{id:`BK-${String(prev.length+1).padStart(3,"0")}`,status:"Solicitado",createdAt:Date.now(),updatedAt:Date.now(),createdBy:user.name,history:[],observations:[],...f},...prev]);setShowNew(false)};
  const chgSt=(id,s)=>{setData(prev=>A(prev).map(r=>r.id===id?{...r,status:s,updatedAt:Date.now(),history:[...r.history,{from:r.status,to:s,at:Date.now(),by:user.name}]}:r));setSel(null)};
  const updReq=(id,fields)=>{setData(prev=>A(prev).map(r=>r.id===id?{...r,...fields,updatedAt:Date.now()}:r));setSel(prev=>prev?{...prev,...fields}:prev)};
  const delReq=id=>{setData(prev=>A(prev).map(r=>r.id===id?{...r,deletedAt:Date.now(),deletedBy:user.name}:r));setSel(null)};
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:16}}>
      {[{l:"Total",v:active.length,c:"#475569",bg:"#F8FAFC",bd:"#E2E8F0"},{l:"Solicitado",v:active.filter(r=>r.status==="Solicitado").length,c:"#B45309",bg:"#FEF3C7",bd:"#FDE68A"},{l:"Urgentes",v:urgC,c:"#DC2626",bg:"#FEF2F2",bd:"#FECACA"},{l:"Aprovado",v:active.filter(r=>r.status==="Aprovado").length,c:"#047857",bg:"#D1FAE5",bd:"#A7F3D0"},{l:"Enviado ao cliente",v:active.filter(r=>r.status==="Enviado ao cliente").length,c:"#0369A1",bg:"#E0F2FE",bd:"#BAE6FD"},{l:"Cancelado",v:active.filter(r=>r.status==="Cancelado").length,c:"#DC2626",bg:"#FEE2E2",bd:"#FECACA"},{l:"Escalonado",v:escC,c:escC?"#DC2626":"#94A3B8",bg:escC?"#FEF2F2":"#F8FAFC",bd:escC?"#FECACA":"#E2E8F0"}].map((s,i)=>
        <div key={i} onClick={()=>setFilter(s.l==="Total"?"Todos":s.l==="Escalonado"?"Escalonados":s.l)} style={{padding:"10px 6px",borderRadius:10,background:s.bg,border:`1px solid ${s.bd}`,textAlign:"center",cursor:"pointer",transition:"transform .15s"}} onMouseOver={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseOut={e=>e.currentTarget.style.transform="none"}><p style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</p><p style={{color:"#94A3B8",fontSize:7,fontWeight:600,textTransform:"uppercase"}}>{s.l}</p></div>)}
    </div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{["Todos","Solicitado","Precisando de estratégia","Aguardando contrato","Urgentes","Aprovado","Enviado ao cliente","Cancelado","Escalonados"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 8px",borderRadius:6,border:filter===f?"none":"1px solid #E2E8F0",background:filter===f?BRAND_LT:"#fff",color:filter===f?BRAND:"#64748B",fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{f}</button>)}</div>
      <button onClick={()=>setShowNew(true)} style={{...bP,padding:"7px 16px",fontSize:11}}>+ Novo Booking</button>
    </div>
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",minWidth:1000}}>
      <thead><tr style={{borderBottom:"2px solid #F1F5F9",background:"#FAFBFC"}}>{["","ID","Cliente","Assunto","Booking","Equip.","Rota","Navio","Armador","Status","SLA",""].map((h,i)=><th key={i} style={{padding:"10px 4px",textAlign:"left",color:"#94A3B8",fontSize:8,fontWeight:700,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
      <tbody>{filt.map(r=>{const esc=isEsc(r),urg=isUrg(r),sla=slaR(r),warn=sla!==null&&sla>0&&sla<URGENT_MS;
        return(<tr key={r.id} onClick={()=>setSel(r)} style={{borderBottom:"1px solid #F1F5F9",background:esc?"#FEF2F2":urg?"#FEF2F2":"#fff",cursor:"pointer"}} onMouseOver={e=>{if(!esc&&!urg)e.currentTarget.style.background="#F8FAFC"}} onMouseOut={e=>{e.currentTarget.style.background=esc?"#FEF2F2":urg?"#FEF2F2":"#fff"}}>
          <td style={{padding:"10px 3px",width:16}}>{urg&&<span title={r.urgentNote}>🔴</span>}{esc&&!urg&&<span style={{animation:"pulse 1s ease infinite",fontSize:10}}>🟠</span>}</td>
          <td style={{padding:"10px 4px",fontSize:10,color:"#94A3B8",fontWeight:600}}>{r.id}</td>
          <td style={{padding:"10px 4px"}}><p style={{fontSize:11,fontWeight:600}}>{r.client}</p></td>
          <td style={{padding:"10px 4px",fontSize:10,color:"#475569",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.subject}</td>
          <td style={{padding:"10px 4px",fontSize:10,color:r.bookingNumber?"#475569":"#CBD5E1"}}>{r.bookingNumber||"—"}</td>
          <td style={{padding:"10px 4px",fontSize:10,whiteSpace:"nowrap"}}>{r.equipQty}x {r.equipType}</td>
          <td style={{padding:"10px 4px",whiteSpace:"nowrap"}}><span style={{color:"#1D4ED8",fontSize:10}}>{r.pol}</span><span style={{color:"#CBD5E1"}}>→</span><span style={{color:"#047857",fontSize:10}}>{r.pod}</span></td>
          <td style={{padding:"10px 4px",fontSize:10,color:"#0F766E"}}>{r.navio||"—"}{r.dataSaida?<span style={{display:"block",fontSize:8,color:"#94A3B8"}}>{fD(r.dataSaida)}</span>:null}</td>
          <td style={{padding:"10px 4px"}}><span style={{padding:"2px 5px",borderRadius:12,fontSize:8,fontWeight:600,background:`${aC(r.armador)}12`,color:aC(r.armador)}}>{r.armador}</span></td>
          <td style={{padding:"10px 4px"}}><span style={{padding:"2px 5px",borderRadius:16,fontSize:8,fontWeight:600,background:ST[r.status]?.bg,color:ST[r.status]?.c}}>{ST[r.status]?.i} {r.status}</span></td>
          <td style={{padding:"10px 4px",fontSize:10,fontWeight:600,whiteSpace:"nowrap",color:sla===null?"#047857":sla>0?(warn?"#B45309":"#475569"):"#DC2626"}}>{sla===null?"✓":sla>0?fT(sla):<span style={{animation:"pulse 1.5s ease infinite"}}>ESTOURADO</span>}</td>
          <td style={{padding:"10px 3px"}}><button onClick={e=>{e.stopPropagation();if(window.confirm("Mover para lixeira?"))delReq(r.id)}} style={{background:"none",border:"none",color:"#CBD5E1",cursor:"pointer",fontSize:11}} title="Excluir">🗑</button></td>
        </tr>)})}
        {filt.length===0&&<tr><td colSpan={12} style={{padding:32,textAlign:"center",color:"#94A3B8",fontSize:12}}>Nenhuma solicitação</td></tr>}
      </tbody></table></div></div>
    {showNew&&<NewBookingModal onClose={()=>setShowNew(false)} onSave={addReq} armadores={armadores}/>}
    {sel&&<BookingDetail req={sel} onClose={()=>setSel(null)} onChangeStatus={chgSt} onUpdate={updReq} onDelete={delReq} user={user}/>}
  </div>);
}

function PendenciasPanel({data,setData,user}){
  const[showNew,setShowNew]=useState(false);const[editP,setEditP]=useState(null);const[selP,setSelP]=useState(null);const[cmt,setCmt]=useState("");
  const pending=A(data).filter(d=>!d.resolved&&!d._deleted);const resolved=A(data).filter(d=>d.resolved&&!d._deleted);
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{display:"flex",gap:12}}>
        <div style={{padding:"12px 20px",borderRadius:10,background:"#FEF3C7",border:"1px solid #FDE68A",textAlign:"center"}}><p style={{fontSize:22,fontWeight:700,color:"#B45309"}}>{pending.length}</p><p style={{fontSize:9,fontWeight:600,textTransform:"uppercase",color:"#92400E"}}>Pendentes</p></div>
        <div style={{padding:"12px 20px",borderRadius:10,background:"#D1FAE5",border:"1px solid #A7F3D0",textAlign:"center"}}><p style={{fontSize:22,fontWeight:700,color:"#047857"}}>{resolved.length}</p><p style={{fontSize:9,fontWeight:600,textTransform:"uppercase",color:"#065F46"}}>Resolvidas</p></div>
      </div>
      <button onClick={()=>setShowNew(true)} style={{...bP,background:"#B45309",padding:"8px 16px",fontSize:11}}>+ Pendência</button>
    </div>
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
      {pending.map(p=><div key={p.id} style={{padding:"12px 16px",borderBottom:"1px solid #F1F5F9"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>BKG: <span style={{color:"#B45309"}}>{p.bookingNumber}</span></p><p style={{fontSize:12,color:"#64748B",marginTop:2}}>{p.observation}</p><p style={{fontSize:9,color:"#94A3B8",marginTop:2}}>{p.createdBy} · {fDt(p.createdAt)}</p>{A(p.comments).map((c,i)=><div key={i} style={{padding:"4px 8px",borderRadius:4,background:"#FFFBEB",marginTop:3}}><p style={{fontSize:11}}>{c.text}</p><p style={{fontSize:8,color:"#94A3B8"}}>{c.by} · {fDt(c.at)}</p></div>)}{selP===p.id&&<div style={{display:"flex",gap:4,marginTop:6}}><input value={cmt} onChange={e=>setCmt(e.target.value)} placeholder="Comentário..." style={{...iS,flex:1,padding:"6px 10px",fontSize:11}} onKeyDown={e=>{if(e.key==="Enter"&&cmt.trim()){setData(prev=>A(prev).map(x=>x.id===p.id?{...x,comments:[...A(x.comments),{text:cmt.trim(),by:user.name,at:Date.now()}]}:x));setCmt("")}}}/><button onClick={()=>{if(cmt.trim()){setData(prev=>A(prev).map(x=>x.id===p.id?{...x,comments:[...A(x.comments),{text:cmt.trim(),by:user.name,at:Date.now()}]}:x));setCmt("")}}} style={{...bP,padding:"5px 10px",fontSize:10}}>+</button></div>}</div><div style={{display:"flex",gap:4,marginLeft:8}}><button onClick={()=>setSelP(selP===p.id?null:p.id)} style={{padding:"4px 8px",borderRadius:4,border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>💬</button><button onClick={()=>setEditP(p)} style={{padding:"4px 8px",borderRadius:4,border:"1px solid #E2E8F0",background:"#fff",color:BRAND,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✏️</button><button onClick={()=>setData(prev=>A(prev).map(x=>x.id===p.id?{...x,resolved:true,resolvedAt:Date.now(),resolvedBy:user.name}:x))} style={{padding:"4px 8px",borderRadius:4,border:"1px solid #A7F3D0",background:"#D1FAE5",color:"#047857",fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✓</button><button onClick={()=>{if(window.confirm("Excluir?"))setData(prev=>A(prev).map(x=>x.id===p.id?{...x,_deleted:true}:x))}} style={{padding:"4px 8px",borderRadius:4,border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>🗑</button></div></div></div>)}
      {!pending.length&&<div style={{padding:32,textAlign:"center",color:"#94A3B8",fontSize:12}}>Nenhuma pendência</div>}
    </div>
    {resolved.length>0&&<div style={{marginTop:12}}><p style={{...lS,marginBottom:6}}>Resolvidas</p><div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>{resolved.map(p=><div key={p.id} style={{padding:"10px 16px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",opacity:.7}}><div><p style={{fontSize:12,fontWeight:600}}>✓ BKG: {p.bookingNumber}</p><p style={{fontSize:11,color:"#64748B"}}>{p.observation}</p></div><div style={{display:"flex",gap:4}}><button onClick={()=>setData(prev=>A(prev).map(x=>x.id===p.id?{...x,resolved:false}:x))} style={{padding:"4px 8px",borderRadius:4,border:"1px solid #FDE68A",background:"#FEF3C7",color:"#B45309",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>↩️</button><button onClick={()=>{if(window.confirm("Excluir?"))setData(prev=>A(prev).map(x=>x.id===p.id?{...x,_deleted:true}:x))}} style={{padding:"4px 8px",borderRadius:4,border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>🗑</button></div></div>)}</div></div>}
    {showNew&&<PendenciaModal onClose={()=>setShowNew(false)} onSave={f=>{setData(prev=>[{id:`PD-${Date.now()}`,...f,resolved:false,createdBy:user.name,createdAt:Date.now(),comments:[]},...A(prev)]);setShowNew(false)}}/>}
    {editP&&<PendenciaModal initial={editP} onClose={()=>setEditP(null)} onSave={f=>{setData(prev=>A(prev).map(x=>x.id===editP.id?{...x,...f}:x));setEditP(null)}}/>}
  </div>);
}

// ═════════════════════════════════════════════
// LIXEIRA (Trash — auto-purge after 5 days)
// ═════════════════════════════════════════════
function LixeiraPanel({data,setData}){
  const trashed=A(data).filter(isTrashed);
  const restore=id=>setData(prev=>A(prev).map(r=>r.id===id?{...r,deletedAt:undefined,deletedBy:undefined}:r));
  const permDel=id=>{if(window.confirm("Apagar permanentemente? Não pode ser desfeito."))setData(prev=>A(prev).filter(r=>r.id!==id))};
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{display:"flex",gap:12}}>
        <div style={{padding:"12px 20px",borderRadius:10,background:"#F8FAFC",border:"1px solid #E2E8F0",textAlign:"center"}}><p style={{fontSize:22,fontWeight:700,color:"#64748B"}}>{trashed.length}</p><p style={{fontSize:9,fontWeight:600,textTransform:"uppercase",color:"#94A3B8"}}>Na Lixeira</p></div>
      </div>
      <p style={{color:"#94A3B8",fontSize:11}}>Itens são apagados automaticamente após 5 dias</p>
    </div>
    {trashed.length>0?<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
      {trashed.map(r=>{
        const days=Math.ceil((Date.now()-r.deletedAt)/86400000);const left=5-days;
        return(<div key={r.id} style={{padding:"12px 16px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
              <span style={{fontSize:11,fontWeight:600,color:"#94A3B8"}}>{r.id}</span>
              <span style={{fontSize:12,fontWeight:600}}>{r.client}</span>
              <span style={{padding:"2px 6px",borderRadius:16,fontSize:8,fontWeight:600,background:ST[r.status]?.bg,color:ST[r.status]?.c}}>{r.status}</span>
            </div>
            <p style={{fontSize:11,color:"#475569"}}>{r.subject}</p>
            <p style={{fontSize:9,color:"#94A3B8",marginTop:2}}>Excluído por {r.deletedBy||"—"} · {fDt(r.deletedAt)} · {left>0?`Será apagado em ${left} dia(s)`:"Será apagado hoje"}</p>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>restore(r.id)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #A7F3D0",background:"#D1FAE5",color:"#047857",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>♻️ Restaurar</button>
            <button onClick={()=>permDel(r.id)} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕ Apagar</button>
          </div>
        </div>)})}
    </div>:<div style={{padding:48,textAlign:"center",color:"#94A3B8",fontSize:13}}>Lixeira vazia</div>}
  </div>);
}

function StandbyPanel({ships,setShips,armadores,setArmadores,user}){
  const[showNew,setShowNew]=useState(false);const[editShip,setEditShip]=useState(null);const[addBkgTo,setAddBkgTo]=useState(null);
  const[editBkg,setEditBkg]=useState(null);const[editBkgShip,setEditBkgShip]=useState(null);
  const addArmador=(newArm)=>{if(setArmadores)setArmadores(prev=>[...prev,newArm])};
  const arms=armadores.map(a=>a.name);
  const armsWithShips=useMemo(()=>arms.filter(a=>ships.some(s=>s.armador===a)),[ships,arms]);
  const armsEmpty=useMemo(()=>arms.filter(a=>!ships.some(s=>s.armador===a)),[ships,arms]);
  const[selArm,setSelArm]=useState(armsWithShips[0]||arms[0]||"");
  useEffect(()=>{if(selArm&&!arms.includes(selArm)&&arms.length)setSelArm(arms[0])},[arms,selArm]);
  // Auto-select first arm with ships if current has none
  useEffect(()=>{if(armsWithShips.length&&!armsWithShips.includes(selArm))setSelArm(armsWithShips[0])},[armsWithShips]);

  const armShips=useMemo(()=>ships.filter(s=>s.armador===selArm).map(s=>({...s,bookings:s.bookings||[]})).sort((a,b)=>{
    const da=a.previsaoSaida?new Date(a.previsaoSaida).getTime():Infinity;
    const db=b.previsaoSaida?new Date(b.previsaoSaida).getTime():Infinity;
    return da-db;
  }),[ships,selArm]);
  const armCfg=armadores.find(a=>a.name===selArm);
  const col=aC(selArm);

  const delShip=id=>{if(window.confirm("Excluir este navio e todos os bookings?"))setShips(prev=>A(prev).filter(s=>s.id!==id))};
  const delBkg=(shipId,bkgId)=>setShips(prev=>A(prev).map(s=>s.id===shipId?{...s,bookings:(s.bookings||[]).filter(b=>b.id!==bkgId)}:s));
  const updBkg=(shipId,updatedBkg)=>setShips(prev=>A(prev).map(s=>s.id===shipId?{...s,bookings:(s.bookings||[]).map(b=>b.id===updatedBkg.id?{...b,...updatedBkg}:b)}:s));

  const totNavios=ships.length;const totBkgs=ships.reduce((a,s)=>a+(s.bookings||[]).length,0);
  const armBkgs=armShips.reduce((a,s)=>a+(s.bookings||[]).length,0);

  // Table header style
  const thS={padding:"8px 10px",textAlign:"left",color:"#fff",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".3px",whiteSpace:"nowrap",position:"sticky",top:0};
  const tdS={padding:"8px 10px",fontSize:11,color:"#1E293B",borderBottom:"1px solid #F1F5F9",whiteSpace:"nowrap"};

  return(<div>
    {/* Summary cards */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{display:"flex",gap:10}}>
        <div style={{padding:"10px 18px",borderRadius:10,background:"#F0FDFA",border:"1px solid #99F6E4",textAlign:"center"}}><p style={{fontSize:20,fontWeight:700,color:"#0F766E"}}>{totNavios}</p><p style={{fontSize:8,fontWeight:600,textTransform:"uppercase",color:"#115E59"}}>Navios</p></div>
        <div style={{padding:"10px 18px",borderRadius:10,background:"#DBEAFE",border:"1px solid #BFDBFE",textAlign:"center"}}><p style={{fontSize:20,fontWeight:700,color:"#1D4ED8"}}>{totBkgs}</p><p style={{fontSize:8,fontWeight:600,textTransform:"uppercase",color:"#1E40AF"}}>Bookings</p></div>
        {armCfg?.ddlDays>0&&<div style={{padding:"10px 18px",borderRadius:10,background:"#FEF2F2",border:"1px solid #FECACA",textAlign:"center"}}><p style={{fontSize:20,fontWeight:700,color:"#DC2626"}}>{armCfg.ddlDays}d</p><p style={{fontSize:8,fontWeight:600,textTransform:"uppercase",color:"#991B1B"}}>DDL Alerta</p></div>}
      </div>
      <button onClick={()=>setShowNew(true)} style={{...bP,background:"#0F766E",padding:"8px 16px",fontSize:11}}>+ Novo Navio</button>
    </div>

    {/* Armador tabs — styled like spreadsheet tabs */}
    <div style={{display:"flex",gap:0,borderBottom:`3px solid ${col}`,marginBottom:0,overflowX:"auto",paddingBottom:0}}>
      {arms.map(arm=>{const ac=aC(arm);const isActive=arm===selArm;const shipCount=ships.filter(s=>s.armador===arm).length;
        return(<button key={arm} onClick={()=>setSelArm(arm)} style={{
          padding:"9px 18px",borderRadius:"8px 8px 0 0",border:isActive?`2px solid ${ac}`:"2px solid #E2E8F0",
          borderBottom:isActive?`3px solid ${ac}`:"2px solid transparent",
          background:isActive?`${ac}12`:"#F8FAFC",color:isActive?ac:"#94A3B8",
          fontSize:11,fontWeight:isActive?700:500,cursor:"pointer",fontFamily:"inherit",
          marginBottom:"-3px",display:"flex",alignItems:"center",gap:6,transition:"all .15s",whiteSpace:"nowrap"
        }}>
          <div style={{width:6,height:6,borderRadius:3,background:isActive?ac:"#CBD5E1"}}/>{arm}
          {shipCount>0&&<span style={{padding:"1px 6px",borderRadius:8,background:isActive?`${ac}20`:"#E2E8F0",fontSize:9,fontWeight:700,color:isActive?ac:"#94A3B8"}}>{shipCount}</span>}
        </button>)
      })}
    </div>

    {/* Content for selected armador */}
    <div style={{background:"#fff",border:`1px solid ${col}20`,borderTop:"none",borderRadius:"0 0 12px 12px",minHeight:200}}>
      {/* Armador sub-header */}
      <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #F1F5F9",background:`${col}05`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <h3 style={{fontSize:15,fontWeight:700,color:col}}>{selArm}</h3>
          <span style={{padding:"2px 10px",borderRadius:10,background:`${col}12`,color:col,fontSize:10,fontWeight:600}}>{armShips.length} navio{armShips.length!==1?"s":""} · {armBkgs} booking{armBkgs!==1?"s":""}</span>
        </div>
        <button onClick={()=>setShowNew(true)} style={{padding:"5px 14px",borderRadius:6,border:`1px solid ${col}30`,background:`${col}08`,color:col,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Navio em {selArm}</button>
      </div>

      {armShips.length===0&&<div style={{padding:48,textAlign:"center"}}><p style={{color:"#CBD5E1",fontSize:32,marginBottom:8}}>🚢</p><p style={{color:"#94A3B8",fontSize:13}}>Nenhum navio cadastrado para <strong style={{color:col}}>{selArm}</strong></p></div>}

      {/* Ships + bookings table layout */}
      {armShips.map(ship=>{
        const bkgs=ship.bookings||[];
        const cancelDays=dUntil(ship.dataCancelamento);const cancelAlert=armCfg?.ddlDays>0&&cancelDays!==null&&cancelDays>=0&&cancelDays<=armCfg.ddlDays;
        let sDdl=null;bkgs.forEach(b=>{if(b.deadlineCarga){const d=dUntil(b.deadlineCarga);if(d!==null&&d>=0&&(sDdl===null||d<sDdl))sDdl=d}});
        const ddlAlert=armCfg?.ddlDays>0&&sDdl!==null&&sDdl<=armCfg.ddlDays;
        const etdStr=ship.previsaoSaida?new Date(ship.previsaoSaida).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}):"—";

        return(<div key={ship.id} style={{borderBottom:`2px solid ${col}15`}}>
          {/* Ship header — like the green/blue row in Excel */}
          <div style={{background:`${col}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{color:"#fff",fontSize:15,fontWeight:800,letterSpacing:".5px"}}>
                {ship.nome} — ETD {etdStr}
              </span>
              {ship.pol&&ship.pod&&<span style={{color:"rgba(255,255,255,.7)",fontSize:11}}>({ship.pol} → {ship.pod})</span>}
              {ddlAlert&&<span style={{padding:"2px 8px",borderRadius:6,background:"#fff",color:"#DC2626",fontSize:9,fontWeight:700,animation:"pulse 1.5s ease infinite"}}>⏰ DDL {sDdl}d!</span>}
              {cancelAlert&&<span style={{padding:"2px 8px",borderRadius:6,background:"#FEF3C7",color:"#92400E",fontSize:9,fontWeight:700}}>⚠ Cancel {cancelDays}d</span>}
            </div>
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>setAddBkgTo(ship)} style={{padding:"4px 12px",borderRadius:5,border:"1px solid rgba(255,255,255,.4)",background:"rgba(255,255,255,.15)",color:"#fff",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Booking</button>
              <button onClick={()=>setEditShip(ship)} style={{padding:"4px 10px",borderRadius:5,border:"1px solid rgba(255,255,255,.3)",background:"rgba(255,255,255,.1)",color:"#fff",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>✏️</button>
              <button onClick={()=>delShip(ship.id)} style={{padding:"4px 10px",borderRadius:5,border:"1px solid rgba(255,255,255,.2)",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.7)",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>🗑</button>
            </div>
          </div>

          {/* Bookings table */}
          {bkgs.length>0?<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:1050}}>
              <thead><tr style={{background:`${col}CC`}}>
                {["Booking","POL","POD","ETD","DDL Draft","Observações","Data Cancelamento","Inicial","Cliente","Usando","Sobra","",""].map((h,i)=>
                  <th key={i} style={{...thS,background:h==="Data Cancelamento"?"#DC2626":h==="Usando"||h==="Sobra"?`${col}EE`:undefined,
                    textAlign:h==="Usando"||h==="Sobra"||h==="Inicial"?"center":undefined}}>{h}</th>
                )}
              </tr></thead>
              <tbody>{bkgs.map(b=>{
                const bD=b.deadlineCarga?dUntil(b.deadlineCarga):null;
                const bA=armCfg?.ddlDays>0&&bD!==null&&bD<=armCfg.ddlDays&&bD>=0;
                const bSobra=(b.qtdDisponivel||b.qtdTotal||0)-(b.qtdUsando||0);
                const cancelStr=ship.dataCancelamento?new Date(ship.dataCancelamento).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}):"—";
                return(<tr key={b.id} style={{background:bA?"#FEF2F2":"#fff",borderBottom:"1px solid #F1F5F9"}} onMouseOver={e=>e.currentTarget.style.background=bA?"#FEE2E2":"#F8FAFC"} onMouseOut={e=>e.currentTarget.style.background=bA?"#FEF2F2":"#fff"}>
                  <td style={{...tdS,fontWeight:700,color:col}}>{b.bookingNumber||"—"}</td>
                  <td style={{...tdS,fontWeight:600}}>{b.pol||ship.pol||"—"}</td>
                  <td style={{...tdS,fontWeight:600}}>{b.pod||ship.pod||"—"}</td>
                  <td style={{...tdS,color:"#64748B"}}>{etdStr}</td>
                  <td style={{...tdS,color:bA?"#DC2626":"#64748B",fontWeight:bA?700:400}}>{b.deadlineCarga?fD(b.deadlineCarga):"—"}{bA?` (${bD}d!)`:""}</td>
                  <td style={{...tdS,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",color:"#64748B",fontSize:10}}>{b.observation||"—"}</td>
                  <td style={{...tdS,background:"#FEF2F220",color:"#DC2626",fontWeight:600,textAlign:"center"}}>{cancelStr}{cancelAlert?` (${cancelDays}d!)`:""}</td>
                  <td style={{...tdS,textAlign:"center",fontWeight:600}}>{b.equipQty||0}x{b.equipType?.replace("Dry ","").replace("Reefer ","R").replace("Open Top ","OT").replace("Flat Rack ","FR")||"40"}</td>
                  <td style={{...tdS,fontWeight:500}}>{b.client||"—"}</td>
                  <td style={{...tdS,textAlign:"center",fontWeight:700,background:"#D1FAE520",color:"#047857"}}>{b.qtdUsando||""}</td>
                  <td style={{...tdS,textAlign:"center",fontWeight:700,background:bSobra>0?"#FEF3C720":"#FEE2E220",color:bSobra>0?"#B45309":"#DC2626"}}>{bSobra||""}</td>
                  <td style={{...tdS,padding:"4px 2px"}}>
                    <button onClick={()=>{setEditBkg(b);setEditBkgShip(ship)}} style={{background:"none",border:"none",color:BRAND,cursor:"pointer",fontSize:11,padding:"2px 4px"}} title="Editar">✏️</button>
                  </td>
                  <td style={{...tdS,padding:"4px 2px"}}>
                    <button onClick={()=>delBkg(ship.id,b.id)} style={{background:"none",border:"none",color:"#CBD5E1",cursor:"pointer",fontSize:11,padding:"2px 4px"}} title="Excluir">✕</button>
                  </td>
                </tr>)})}</tbody>
            </table>
          </div>:<div style={{padding:"16px",textAlign:"center",color:"#CBD5E1",fontSize:11}}>Nenhum booking neste navio · <button onClick={()=>setAddBkgTo(ship)} style={{background:"none",border:"none",color:col,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit",textDecoration:"underline"}}>Adicionar</button></div>}
        </div>)
      })}
    </div>

    {armsEmpty.length>0&&<p style={{color:"#CBD5E1",fontSize:10,textAlign:"center",marginTop:10}}>Sem navios: {armsEmpty.join(", ")}</p>}
    {showNew&&<ShipModal onClose={()=>setShowNew(false)} onSave={f=>{setShips(prev=>[{id:`NV-${Date.now()}`,bookings:[],...f,createdBy:user.name,createdAt:Date.now()},...prev]);setShowNew(false)}} armadores={armadores} onAddArmador={addArmador}/>}
    {editShip&&<ShipModal onClose={()=>setEditShip(null)} onSave={f=>{setShips(prev=>A(prev).map(s=>s.id===editShip.id?{...s,...f}:s));setEditShip(null)}} armadores={armadores} initial={editShip} onAddArmador={addArmador}/>}
    {addBkgTo&&<AddShipBookingModal onClose={()=>setAddBkgTo(null)} onSave={f=>{setShips(prev=>A(prev).map(s=>s.id===addBkgTo.id?{...s,bookings:[...s.bookings,{id:`SBK-${Date.now()}`,createdAt:Date.now(),...f}]}:s));setAddBkgTo(null)}} ship={addBkgTo}/>}
    {editBkg&&editBkgShip&&<EditShipBookingModal onClose={()=>{setEditBkg(null);setEditBkgShip(null)}} onSave={f=>{updBkg(editBkgShip.id,f);setEditBkg(null);setEditBkgShip(null)}} ship={editBkgShip} booking={editBkg}/>}
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

  const applyState=useCallback((d)=>{
    if(d.bookings)setBookings(d.bookings);
    if(d.pendencias)setPendencias(d.pendencias);
    if(d.ships)setShips(d.ships.map(s=>({...s,bookings:s.bookings||[]})));
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

  const lastLocalChange=useRef(0);
  const saveRef=useRef(null);

  // SAVE on any change — debounced 400ms to batch rapid changes
  useEffect(()=>{
    if(!loaded)return;
    lastLocalChange.current=Date.now();
    const state={bookings,pendencias,ships,users,armadores,logo};
    try{localStorage.setItem("booking-control-data",JSON.stringify(state))}catch(e){console.warn("localStorage save failed",e)}
    if(supabase&&user){
      if(saveRef.current)clearTimeout(saveRef.current);
      saveRef.current=setTimeout(()=>{
        try{saveState(state,user.name).catch(e=>console.warn("Supabase save error",e))}catch(e){console.warn("Save error",e)}
      },400);
    }
  },[bookings,pendencias,ships,users,armadores,logo,loaded]);

  // REALTIME subscription — ignore updates within 4s of local change
  useEffect(()=>{
    if(!supabase)return;
    const unsub=subscribeToChanges((newData)=>{
      if(Date.now()-lastLocalChange.current>4000){
        try{applyState(newData)}catch(e){console.warn("Apply state error",e)}
      }
    });
    return unsub;
  },[applyState]);

  // ─── PUSH NOTIFICATIONS SYSTEM ───
  const notifiedRef=useRef({});const[notifPerm,setNotifPerm]=useState("default");
  // Request permission on login
  useEffect(()=>{
    if(!user)return;
    if("Notification" in window){
      setNotifPerm(Notification.permission);
      if(Notification.permission==="default"){
        Notification.requestPermission().then(p=>setNotifPerm(p));
      }
    }
  },[user]);

  // Check deadlines every 60s and fire push notifications
  useEffect(()=>{
    if(!user||!loaded)return;
    const check=()=>{
      const alerts=[];
      armadores.forEach(arm=>{
        if(arm.ddlDays<=0)return;
        ships.filter(s=>s.armador===arm.name).forEach(s=>{
          (s.bookings||[]).forEach(b=>{
            if(!b.deadlineCarga)return;
            const d=dUntil(b.deadlineCarga);
            if(d!==null&&d>=0&&d<=arm.ddlDays){
              const key=`ddl-${b.id||b.bookingNumber}-${d}`;
              if(!notifiedRef.current[key]){
                alerts.push({title:`⏰ DDL Carga em ${d} dia(s)!`,body:`${arm.name} — "${s.nome}" BKG ${b.bookingNumber||"s/n"}: Deadline de carga ${fD(b.deadlineCarga)}`,key});
              }
            }
          });
          // Also check ship cancellation date
          if(s.dataCancelamento){
            const dc=dUntil(s.dataCancelamento);
            if(dc!==null&&dc>=0&&dc<=arm.ddlDays){
              const key=`cancel-${s.id}-${dc}`;
              if(!notifiedRef.current[key]){
                alerts.push({title:`⚠️ Cancelamento em ${dc} dia(s)!`,body:`${arm.name} — "${s.nome}": Data de cancelamento ${fD(s.dataCancelamento)}`,key});
              }
            }
          }
        });
      });
      // SLA estourado
      bookings.filter(r=>!isTrashed(r)).forEach(r=>{
        if(isEsc(r)){
          const key=`sla-${r.id}`;
          if(!notifiedRef.current[key]){
            alerts.push({title:"🚨 SLA Estourado!",body:`Booking ${r.id} — ${r.client}: ${r.subject}`,key});
          }
        }
      });
      // Fire push notifications
      if("Notification" in window&&Notification.permission==="granted"){
        alerts.forEach(a=>{
          try{
            const n=new Notification(a.title,{body:a.body,icon:logo||undefined,tag:a.key,requireInteraction:true,badge:logo||undefined});
            n.onclick=()=>{window.focus();n.close()};
            notifiedRef.current[a.key]=Date.now();
          }catch(e){console.warn("Notification error",e)}
        });
      }
      // Play alert sound for critical alerts
      if(alerts.length>0){
        try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const osc=ctx.createOscillator();const gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=880;gain.gain.value=0.08;osc.start();osc.stop(ctx.currentTime+0.15);setTimeout(()=>{const o2=ctx.createOscillator();const g2=ctx.createGain();o2.connect(g2);g2.connect(ctx.destination);o2.frequency.value=1100;g2.gain.value=0.06;o2.start();o2.stop(ctx.currentTime+0.12)},180)}catch{}
      }
      // Cleanup old entries (>24h)
      const now=Date.now();Object.keys(notifiedRef.current).forEach(k=>{if(now-notifiedRef.current[k]>86400000)delete notifiedRef.current[k]});
    };
    check();
    const iv=setInterval(check,60000);
    return()=>clearInterval(iv);
  },[user,loaded,ships,bookings,armadores,logo]);

  const refresh=async()=>{
    setRefreshing(true);
    if(supabase){const d=await loadState();if(d)applyState(d)}
    setTimeout(()=>setRefreshing(false),500);
  };

  if(!user)return<ErrorBoundary><Login onLogin={setUser} users={users} logo={logo}/></ErrorBoundary>;
  const at=TABS.find(t=>t.id===tab);

  return(<ErrorBoundary>
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
        <Notifications bookings={bookings} ships={ships} armadores={armadores} notifPerm={notifPerm} onRequestPerm={()=>{if("Notification" in window)Notification.requestPermission().then(p=>setNotifPerm(p))}}/>
        {tab==="bookings"&&<BookingsPanel data={bookings} setData={setBookings} armadores={armadores} user={user}/>}
        {tab==="pendencias"&&<PendenciasPanel data={pendencias} setData={setPendencias} user={user}/>}
        {tab==="standby"&&<StandbyPanel ships={ships} setShips={setShips} armadores={armadores} setArmadores={setArmadores} user={user}/>}
        {tab==="lixeira"&&<LixeiraPanel data={bookings} setData={setBookings}/>}
      </div>
      {showUsers&&<UserManager users={users} onSave={l=>{setUsers(l);setShowUsers(false)}} onClose={()=>setShowUsers(false)}/>}
      {showArm&&<ArmadorManager armadores={armadores} onSave={l=>{setArmadores(l);setShowArm(false)}} onClose={()=>setShowArm(false)}/>}
      {showLogo&&<LogoManager logo={logo} onSave={l=>{setLogo(l);setShowLogo(false)}} onClose={()=>setShowLogo(false)}/>}
    </div>
  </ErrorBoundary>);
}
