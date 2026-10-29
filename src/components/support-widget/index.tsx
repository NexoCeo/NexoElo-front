import {useEffect,useState,type FormEvent} from "react";
import api from "@/services/api";
import styles from "./style.module.css";
type Conversation={id:string;subject:string;channel:string;status:string;createdAt:string;ended:string|null};
type Message={id:string;sender:"agent"|"client";senderName:string;body:string;createdAt:string};
export default function SupportWidget(){
 const [open,setOpen]=useState(false);
 const [widgetSize,setWidgetSize]=useState({width:470,height:745});
 useEffect(()=>{let active=true;api.get<{width:number;height:number}>("suporte/configuracao-widget").then(({data})=>{if(active&&Number.isFinite(data.width)&&Number.isFinite(data.height))setWidgetSize({width:Math.max(320,Math.min(650,data.width)),height:Math.max(400,Math.min(950,data.height))})}).catch(()=>{});return()=>{active=false}},[]);
 const [view,setView]=useState<"new"|"history"|"conversation">("history");
 const [channel,setChannel]=useState<"chat"|"email">("chat");
 const [subject,setSubject]=useState("");
 const [description,setDescription]=useState("");
 const [history,setHistory]=useState<Conversation[]>([]);
 const [messages,setMessages]=useState<Message[]>([]);
 const [selected,setSelected]=useState<Conversation|null>(null);
 const [draft,setDraft]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [historyLoading,setHistoryLoading]=useState(false);
 const [historyFailed,setHistoryFailed]=useState(false);
 async function refreshHistory(){
  setHistoryLoading(true);setHistoryFailed(false);setError("");
  try{
   const {data}=await api.get<Conversation[]>("suporte/historico");
   if(!Array.isArray(data))throw new Error("Formato inválido");
   setHistory(data);
  }catch(e){
   setHistoryFailed(true);
   const status=(e as {response?:{status?:number}})?.response?.status;
   setError(status===401?"Sua sessão expirou. Entre novamente no NexoElo.":status===503?"O histórico está temporariamente indisponível.":"Não foi possível consultar o histórico. Tente novamente.");
  }finally{setHistoryLoading(false)}
 }
 async function refreshMessages(id:string){
  try{const {data}=await api.get<Message[]>("suporte/conversas/"+id+"/mensagens");setMessages(data)}catch{setError("Não foi possível carregar as mensagens.")}
 }
 useEffect(()=>{if(!open)return;void refreshHistory()},[open]);
 useEffect(()=>{if(!open||view!=="conversation"||!selected)return;
 void refreshMessages(selected.id);
 const timer=window.setInterval(()=>{void refreshMessages(selected.id)},5000);
 return()=>window.clearInterval(timer);
 },[open,view,selected?.id]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError("");
  try{
   const {data}=await api.post<{id:string}>("suporte/chamados",{assunto:subject,descricao:description,canal:channel});
   const item:Conversation={id:data.id,subject,channel,status:"open",createdAt:new Date().toISOString(),ended:null};
   setSelected(item);setMessages([{id:"initial",sender:"client",senderName:"Você",body:description,createdAt:new Date().toISOString()}]);setSubject("");setDescription("");setView("conversation");void refreshHistory();
  }catch(e){const err=e as {response?:{data?:{message?:string}}};setError(err.response?.data?.message||"Não foi possível iniciar o atendimento.")}
  finally{setBusy(false)}
 }
 async function send(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!selected||!draft.trim()||busy)return;setBusy(true);setError("");
  try{await api.post("suporte/conversas/"+selected.id+"/mensagens",{mensagem:draft.trim()});setDraft("");await refreshMessages(selected.id)}
  catch{setError("Não foi possível enviar a mensagem.")}finally{setBusy(false)}
 }
 function openConversation(item:Conversation){setSelected(item);setMessages([]);setError("");setView("conversation")}
 return <div className={styles.host}>
 {open&&<section className={styles.panel} style={{width:widgetSize.width,height:widgetSize.height}} role="dialog" aria-label="Suporte NexoElo">
  <header className={styles.heading}><div><strong>Suporte NexoElo</strong><span>Atendimento via NexoDesk</span></div><button type="button" onClick={()=>setOpen(false)} aria-label="Fechar">×</button></header>
  <nav className={styles.channelTabs} aria-label="Navegação do suporte">
   <button type="button" className={view==="history"?styles.selected:""} onClick={()=>{setView("history");void refreshHistory()}}>Histórico</button>
   <button type="button" className={view==="new"?styles.selected:""} onClick={()=>setView("new")}>Novo atendimento</button>
  </nav>
  {view==="history"&&<div className={styles.history}>{historyLoading?<p>Carregando atendimentos...</p>:historyFailed?<div className={styles.historyFailure}><p>Não foi possível carregar seus atendimentos.</p><button type="button" onClick={()=>void refreshHistory()}>Tentar novamente</button></div>:history.length===0?<p>Nenhum atendimento registrado.</p>:history.map(item=><button key={item.id} type="button" onClick={()=>openConversation(item)}><strong>{item.subject}</strong><span>{item.channel==="chat"?"Chat":"E-mail"} · {item.ended?"Conversa encerrada":item.status==="resolved"?"Resolvido":"Em atendimento"}</span></button>)}</div>}
  {view==="new"&&<><div className={styles.channelTabs}><button type="button" className={channel==="chat"?styles.selected:""} onClick={()=>setChannel("chat")}>Chat</button><button type="button" className={channel==="email"?styles.selected:""} onClick={()=>setChannel("email")}>E-mail</button></div>
   <form onSubmit={submit} className={styles.form}><label>Assunto<input required maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Como podemos ajudar?"/></label><label>Mensagem<textarea required maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descreva sua solicitação..."/></label><button className={styles.submit} disabled={busy}>{busy?"Enviando...":channel==="chat"?"Iniciar chat":"Registrar e-mail"}</button></form></>}
  {view==="conversation"&&selected&&<><div className={styles.threadTitle}><button type="button" onClick={()=>{setView("history");void refreshHistory()}}>← Voltar</button><strong>{selected.subject}</strong></div><div className={styles.messages}>{messages.map(m=><div key={m.id} className={m.sender==="client"?styles.clientBubble:styles.agentBubble}><small>{m.sender==="client"?"Você":m.senderName}</small><p>{m.body}</p></div>)}</div>{selected.channel==="chat"&&!selected.ended&&selected.status!=="resolved"?<form className={styles.messageForm} onSubmit={send}><input aria-label="Nova mensagem" maxLength={4000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Digite sua mensagem..." /><button type="submit" disabled={busy||!draft.trim()}>Enviar</button></form>:<p className={styles.closedHint}>Histórico disponível para consulta.</p>}</>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
 </section>}
 <button className={styles.fab} type="button" aria-label="Abrir suporte" onClick={()=>setOpen(v=>!v)}> <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="2" y="13" width="5" height="7" rx="2"/><rect x="17" y="13" width="5" height="7" rx="2"/><path d="M20 20c0 2-4 3-7 3h-2"/></svg></button>
 </div>
}
