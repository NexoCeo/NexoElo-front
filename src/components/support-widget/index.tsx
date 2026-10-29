import {useEffect} from "react";

/**
 * O NexoElo não mantém layout, chat, tamanho ou tema do suporte.
 * O script hospedado no NexoDesk entrega toda a interface e a configuração.
 * A sessão é emitida pelo backend autenticado do NexoElo.
 */
export default function SupportWidget(){
 useEffect(()=>{
  const id="nexodesk-central-widget-script";
  if(document.getElementById(id))return;
  const script=document.createElement("script");
  script.id=id;
  script.src=import.meta.env.VITE_NEXODESK_WIDGET_URL || "https://nexodesk-back.onrender.com/widget.js";
  script.dataset.sessionUrl="/api/suporte/sessao-widget";
  script.async=true;
  document.body.appendChild(script);
  return()=>{
   script.remove();
   document.getElementById("nexodesk-embed-host")?.remove();
  };
 },[]);
 return null;
}
