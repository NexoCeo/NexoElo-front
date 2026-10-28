import { useState, type FormEvent } from "react";
import api from "@/services/api";
import styles from "./style.module.css";

export default function SupportWidget() {
 const [open,setOpen]=useState(false);
 const [channel,setChannel]=useState<"chat"|"email">("chat");
 const [subject,setSubject]=useState("");
 const [description,setDescription]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [created,setCreated]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;
  setBusy(true);setError("");
  try{
   const response=await api.post<{id:string}>("suporte/chamados",{assunto:subject,descricao:description,canal:channel});
   setCreated(response.data.id);setSubject("");setDescription("");
  }catch(e){
   const err=e as {response?:{data?:{message?:string}}};
   setError(err.response?.data?.message||"Não foi possível enviar a solicitação. Tente novamente.");
  }finally{setBusy(false)}
 }
 return <div className={styles.host}>
  {open&&<section className={styles.panel} role="dialog" aria-modal="false" aria-label="Suporte NexoElo">
   <header className={styles.heading}><div><strong>Suporte NexoElo</strong><span>Atendimento via NexoDesk</span></div><button type="button" onClick={()=>setOpen(false)} aria-label="Fechar suporte">×</button></header>
   <nav className={styles.channelTabs} aria-label="Canais de suporte"><button type="button" className={channel==="chat"?styles.selected:""} onClick={()=>{setChannel("chat");setError("");setCreated("")}}>Chat</button><button type="button" className={channel==="email"?styles.selected:""} onClick={()=>{setChannel("email");setError("");setCreated("")}}>E-mail</button></nav>
   {created?<div className={styles.success}><strong>Solicitação registrada!</strong><p>Seu chamado foi encaminhado para a equipe de suporte.</p><button type="button" onClick={()=>setCreated("")}>Abrir outro chamado</button></div>:
   <form onSubmit={submit} className={styles.form}><p className={styles.channelHelp}>{channel==="chat"?"Solicite um atendimento por chat. A troca de mensagens ao vivo ainda está em desenvolvimento.":"Registre uma solicitação pelo canal e-mail. A entrega para uma caixa postal ainda requer configuração do serviço de e-mail."}</p>
    <label>Assunto<input required maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Como podemos ajudar?"/></label>
    <label>Descreva sua solicitação<textarea required maxLength={4000} rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Explique o que está acontecendo..."/></label>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <button className={styles.submit} type="submit" disabled={busy}>{busy?"Enviando...":channel==="chat"?"Abrir atendimento":"Enviar solicitação"}</button>
   </form>}
  </section>}
  <button className={styles.fab} type="button" aria-label={open?"Fechar suporte":"Abrir suporte"} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M3 14v-3a9 9 0 0 1 18 0v3"/><rect x="2" y="13" width="5" height="7" rx="2"/><rect x="17" y="13" width="5" height="7" rx="2"/><path d="M20 20c0 2-4 3-7 3h-2"/></svg></button>
 </div>
}
