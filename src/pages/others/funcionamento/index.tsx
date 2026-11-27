import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/modal";
import { createPortal } from "react-dom";
import { isAxiosError } from "axios";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaClock,
  FaCoffee,
  FaUtensils,
  FaHamburger,
  FaBed,
  FaBroom,
  FaTools,
  FaPlus,
  FaSave,
  FaTrash,
  FaPencilAlt,
  FaChevronDown,
  FaSlidersH,
} from "react-icons/fa";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import {
  criarFuncionamentoPadrao,
  obterFuncionamento,
  salvarFuncionamento,
} from "@/services/funcionamento-service";
import type { DiaFuncionamentoKey, FuncionamentoConfig, FuncionamentoIntervalo, TipoPausa } from "@/types/funcionamento";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";
import LoadingState from "@/components/loading-state";
import { usePageRevalidation } from "@/hooks/usePageRevalidation";

const DIAS: Array<{ key: DiaFuncionamentoKey; label: string; short: string }> = [
  { key: "Domingo", label: "Domingo", short: "Dom" },
  { key: "Segunda", label: "Segunda", short: "Seg" },
  { key: "Terca", label: "Terca", short: "Ter" },
  { key: "Quarta", label: "Quarta", short: "Qua" },
  { key: "Quinta", label: "Quinta", short: "Qui" },
  { key: "Sexta", label: "Sexta", short: "Sex" },
  { key: "Sabado", label: "Sabado", short: "Sab" },
];

const DIAS_UTEIS = new Set<DiaFuncionamentoKey>([
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
]);

type ApiError =
  | string
  | {
      erro?: string;
      message?: string;
      title?: string;
      errors?: Record<string, string[]>;
    };

function getApiErrorMessage(data?: ApiError, fallback = "Nao foi possivel salvar o funcionamento.") {
  if (!data) return fallback;
  if (typeof data === "string") return data;

  if (data.errors) {
    const messages = Object.entries(data.errors)
      .flatMap(([field, errors]) => errors.map((error) => `${field}: ${error}`))
      .join(" ");

    if (messages) return messages;
  }

  return data.erro || data.message || data.title || fallback;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatDuration(value: number) {
  const safeValue = Math.max(0, value);
  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

function hasIntervaloInvalido(config: FuncionamentoConfig) {
  const abertura = timeToMinutes(config.HorarioAbertura);
  const fechamento = timeToMinutes(config.HorarioFechamento);

  return config.Intervalos.some((intervalo) => {
    if (!intervalo.Inicio || !intervalo.Fim) return true;

    const inicio = timeToMinutes(intervalo.Inicio);
    const fim = timeToMinutes(intervalo.Fim);
    return inicio >= fim || inicio < abertura || fim > fechamento;
  });
}

function hasIntervaloSobreposto(config: FuncionamentoConfig) {
  const intervalosOrdenados = [...config.Intervalos]
    .filter((intervalo) => intervalo.Inicio && intervalo.Fim)
    .sort((a, b) => timeToMinutes(a.Inicio) - timeToMinutes(b.Inicio));

  return intervalosOrdenados.some((intervalo, index) => {
    const nextIntervalo = intervalosOrdenados[index + 1];
    return Boolean(nextIntervalo && timeToMinutes(intervalo.Fim) > timeToMinutes(nextIntervalo.Inicio));
  });
}

function getPausaTotal(config: FuncionamentoConfig) {
  return config.Intervalos.reduce(
    (total, intervalo) => total + Math.max(0, timeToMinutes(intervalo.Fim) - timeToMinutes(intervalo.Inicio)),
    0,
  );
}

function getNovoIntervalo(config: FuncionamentoConfig) {
  const abertura = timeToMinutes(config.HorarioAbertura);
  const fechamento = timeToMinutes(config.HorarioFechamento);
  const duracao = fechamento - abertura;

  if (duracao <= 30) return null;

  const horarioPreferido = config.Intervalos.length === 0 ? 12 * 60 : 15 * 60;
  const intervalos = config.Intervalos.map((intervalo) => ({
    inicio: timeToMinutes(intervalo.Inicio),
    fim: timeToMinutes(intervalo.Fim),
  }));

  for (const duracaoPausa of [60, 30, 15]) {
    const candidatos: number[] = [];

    for (let inicio = Math.ceil(abertura / 15) * 15; inicio + duracaoPausa <= fechamento; inicio += 15) {
      candidatos.push(inicio);
    }

    candidatos.sort((a, b) => Math.abs(a - horarioPreferido) - Math.abs(b - horarioPreferido));
    const inicioLivre = candidatos.find((inicio) =>
      intervalos.every((intervalo) => inicio + duracaoPausa <= intervalo.inicio || inicio >= intervalo.fim),
    );

    if (inicioLivre !== undefined) {
      return {
        Inicio: minutesToTime(inicioLivre),
        Fim: minutesToTime(inicioLivre + duracaoPausa),
      };
    }
  }

  return null;
}

type ConfigBlock = "availability" | "days" | "times" | "custom" | "breaks";
function blockPatch(block: ConfigBlock, draft: FuncionamentoConfig): Partial<FuncionamentoConfig> {
  switch(block) {
    case "availability": return { HorariosPorDia: draft.HorariosPorDia };
    case "days": return Object.fromEntries(DIAS.map(d => [d.key,draft[d.key]])) as Partial<FuncionamentoConfig>;
    case "times": return { HorarioAbertura:draft.HorarioAbertura,HorarioFechamento:draft.HorarioFechamento };
    case "custom": return { HorariosPorDia:draft.HorariosPorDia };
    case "breaks": return { Intervalos:draft.Intervalos };
  }
}
const BREAK_TYPES: {value:TipoPausa;label:string}[] = [
  {value:"CAFE",label:"Café"}, {value:"ALMOCO",label:"Almoço"}, {value:"LANCHE",label:"Lanche"}, {value:"JANTAR",label:"Jantar"}, {value:"DESCANSO",label:"Descanso"}, {value:"COMPROMISSO",label:"Compromisso pessoal"}, {value:"LIMPEZA",label:"Limpeza e organização"}, {value:"MANUTENCAO",label:"Manutenção"}, {value:"OUTRO",label:"Outro"},
];
const BREAK_ICONS = {CAFE:FaCoffee,ALMOCO:FaUtensils,LANCHE:FaHamburger,JANTAR:FaUtensils,DESCANSO:FaBed,COMPROMISSO:FaCalendarAlt,LIMPEZA:FaBroom,MANUTENCAO:FaTools,OUTRO:FaClock};
function BreakCard({interval,index,startLabel,endLabel,min,max,busy,onRemove,onEdit}:{interval:FuncionamentoIntervalo;index:number;startLabel:string;endLabel:string;min:string;max:string;busy:boolean;onRemove:()=>void;onEdit:()=>void}) {
  const type = interval.Tipo ?? "OUTRO";
  const BreakIcon = BREAK_ICONS[type] ?? FaClock;
  return <article className={styles.breakCard}>
    <div className={styles.breakHeading}><BreakIcon aria-hidden="true"/><strong>{BREAK_TYPES.find(option=>option.value===type)?.label ?? "Outro"}</strong><button type="button" className={styles.removeButton} disabled={busy} onClick={onRemove} aria-label={`Remover pausa ${index+1}`}><FaTrash aria-hidden="true"/></button></div>
    <div className={styles.breakFields}>
      <label>{startLabel}<input type="time" value={interval.Inicio} min={min} max={max} step="900" readOnly/></label>
      <label>{endLabel}<input type="time" value={interval.Fim} min={min} max={max} step="900" readOnly/></label>
    </div>
    <div className={styles.breakFooter}><span className={styles.breakDuration}>{formatDuration(timeToMinutes(interval.Fim)-timeToMinutes(interval.Inicio))}</span><button type="button" className={styles.customizeButton} style={{minHeight:28,padding:"4px 12px",background:"#2563eb",color:"#fff",border:0}} disabled={busy} onClick={onEdit}>Editar</button></div>
  </article>;
}
export default function Funcionamento() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { usuario } = useUser();
  const { showNotification } = useNotification();
  const [config, setConfig] = useState<FuncionamentoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBreakIndex,setEditingBreakIndex] = useState<number|null>(null);
  const [breakDraft,setBreakDraft] = useState<FuncionamentoIntervalo|null>(null);
  const [savingBlock,setSavingBlock] = useState<ConfigBlock|null>(null);
  const [savedSnapshot,setSavedSnapshot] = useState<FuncionamentoConfig|null>(null);
  const [customOwner,setCustomOwner] = useState<"availability"|"custom">("custom");
  const [savedMode,setSavedMode] = useState<"padrao"|"personalizado">("padrao");
  const [availabilityMode, setAvailabilityMode] = useState<"padrao" | "personalizado">("padrao");
  const [customModalOpen,setCustomModalOpen] = useState(false);
  const customModalSnapshot = useRef<{ horarios:FuncionamentoConfig["HorariosPorDia"]; mode:"padrao"|"personalizado"; owner:"availability"|"custom" }|null>(null);
  const lastSavedConfig = useRef("");

  const usuarioId = usuario?.Id ?? 0;
  const diasSelecionados = useMemo(
    () => (config ? DIAS.filter((dia) => config[dia.key]) : []),
    [config],
  );
  const expedienteTotal = config
    ? timeToMinutes(config.HorarioFechamento) - timeToMinutes(config.HorarioAbertura)
    : 0;
  const horariosPorDia = config?.HorariosPorDia ?? {};
  const temHorariosPersonalizados = availabilityMode === "personalizado";

  useEffect(() => {
    async function loadFuncionamento() {
      if (!usuarioId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await obterFuncionamento(usuarioId);
        setConfig(data);
        lastSavedConfig.current = JSON.stringify(data);
        setSavedSnapshot(data);

        const mode = Object.keys(data.HorariosPorDia ?? {}).length > 0 ? "personalizado" : "padrao";
        setAvailabilityMode(mode);
        setSavedMode(mode);
      } catch {
        const message = t("hours.loadError");
        showNotification({ type: "error", title: t("hours.unavailable"), message });
        const defaults = criarFuncionamentoPadrao(usuarioId);
        setConfig(defaults);
        lastSavedConfig.current = JSON.stringify(defaults);
        setSavedSnapshot(null);

        setAvailabilityMode("padrao");
        setSavedMode("padrao");
      } finally {
        setLoading(false);
      }
    }

    loadFuncionamento();
  }, [showNotification, usuarioId]);

  usePageRevalidation(async () => {
    if (!usuarioId) return;
    try {
      const data = await obterFuncionamento(usuarioId);
      setConfig(data);
      lastSavedConfig.current = JSON.stringify(data);
        setSavedSnapshot(data);

      const mode = Object.keys(data.HorariosPorDia ?? {}).length > 0 ? "personalizado" : "padrao";
        setAvailabilityMode(mode);
        setSavedMode(mode);
    } catch { /* preserve settings while offline */ }
  }, {
    enabled: Boolean(usuarioId) && !saving && !customModalOpen &&
      (config === null || (JSON.stringify(config) === lastSavedConfig.current && availabilityMode === savedMode)),
  });

  function updateConfig(nextConfig: Partial<FuncionamentoConfig>) {
    setConfig((currentConfig) => currentConfig ? { ...currentConfig, ...nextConfig } : currentConfig);
  }

  function chooseAvailabilityMode(mode: "padrao" | "personalizado") {
    if (!config || saving) return;
    if (mode === "padrao") {
      setCustomOwner("availability");
      updateConfig({ HorariosPorDia: {} });
    } else {
      customModalSnapshot.current = {horarios:config.HorariosPorDia,mode:availabilityMode,owner:customOwner};
      setCustomOwner("availability");
      setCustomModalOpen(true);
    }
    setAvailabilityMode(mode);
  }

  function closeCustomModal() {
    if(saving) return;
    const snapshot=customModalSnapshot.current;
    if(snapshot) {
      updateConfig({HorariosPorDia:snapshot.horarios});
      setAvailabilityMode(snapshot.mode);
      setCustomOwner(snapshot.owner);
    }
    customModalSnapshot.current=null;
    setCustomModalOpen(false);
  }

  function confirmCustomModal() {
    if(saving || !config) return;
    setAvailabilityMode(Object.keys(config.HorariosPorDia ?? {}).length ? "personalizado" : "padrao");
    setCustomOwner("availability");
    customModalSnapshot.current=null;
    setCustomModalOpen(false);
  }

  function toggleDia(dia: DiaFuncionamentoKey) {
    if (!config || saving) return;
    setDiasSelecionados(new Set(DIAS.filter(d=>d.key===dia?!config[dia]:config[d.key]).map(d=>d.key)));
  }

  function setDiasSelecionados(dias: Set<DiaFuncionamentoKey>) {
    if (!config || saving) return;
    const selection = DIAS.reduce((result, dia) => {
      result[dia.key] = dias.has(dia.key);
      return result;
    }, {} as Record<DiaFuncionamentoKey, boolean>);
    updateConfig(selection);
  }

  function personalizarDia(dia: DiaFuncionamentoKey) {
    setCustomOwner("availability");
    if (!config || saving || !config[dia]) return;
    const next = { ...config.HorariosPorDia };
    if (next[dia]) {
      delete next[dia];
    } else {
      next[dia] = {
        Inicio: config.HorarioAbertura,
        Fim: config.HorarioFechamento,
        Intervalos: config.Intervalos.map(item => ({ ...item })),
      };
    }
    updateConfig({ HorariosPorDia: next });
    setAvailabilityMode(Object.keys(next).length ? "personalizado" : "padrao");
  }

  function alterarHorarioDia(dia: DiaFuncionamentoKey, campo: "Inicio" | "Fim", valor: string) {
    setCustomOwner("custom");
    const current = config?.HorariosPorDia?.[dia];
    if (!current) return;
    updateConfig({
      HorariosPorDia: { ...config?.HorariosPorDia, [dia]: { ...current, [campo]: valor } },
    });
  }

  function removerPausaDia(dia: DiaFuncionamentoKey, index: number) {
    setCustomOwner("custom");
    const current = config?.HorariosPorDia?.[dia];
    if (!current) return;
    updateConfig({
      HorariosPorDia: { ...config?.HorariosPorDia, [dia]: { ...current,
        Intervalos: current.Intervalos.filter((_, i) => i !== index) } },
    });
  }

  function adicionarPausaDia(dia: DiaFuncionamentoKey) {
    setCustomOwner("custom");
    const current = config?.HorariosPorDia?.[dia];
    if (!current) return;
    const nova = getNovoIntervalo({
      ...config!, HorarioAbertura: current.Inicio, HorarioFechamento: current.Fim,
      Intervalos: current.Intervalos,
    });
    if (!nova) {
      showNotification({ type: "warning", title: t("hours.noBreakSpace"),
        message: t("hours.noBreakSpaceDesc") });
      return;
    }
    updateConfig({ HorariosPorDia: { ...config?.HorariosPorDia, [dia]: {
      ...current, Intervalos: [...current.Intervalos, nova],
    } } });
  }

  function alterarPausaDia(dia: DiaFuncionamentoKey, index: number, campo: "Inicio" | "Fim", valor: string) {
    setCustomOwner("custom");
    const current = config?.HorariosPorDia?.[dia];
    if (!current) return;
    updateConfig({ HorariosPorDia: { ...config?.HorariosPorDia, [dia]: {
      ...current, Intervalos: current.Intervalos.map((pausa, i) =>
        i === index ? { ...pausa, [campo]: valor } : pausa),
    } } });
  }

  function addIntervalo() {
    if (!config) return;
    const novoIntervalo = getNovoIntervalo(config);

    if (!novoIntervalo) {
      const message = t("hours.shortDay");
      showNotification({ type: "warning", title: t("hours.breakNotAdded"), message });
      return;
    }

    setEditingBreakIndex(null);
    setBreakDraft({...novoIntervalo,Tipo:"OUTRO"});
  }

  async function confirmBreak() {
    if (!config || !breakDraft || saving) return;
    if (editingBreakIndex !== null && !config.Intervalos[editingBreakIndex]) return;
    const candidate = {...config, Intervalos:editingBreakIndex === null ? [...config.Intervalos,breakDraft] : config.Intervalos.map((item,index)=>index===editingBreakIndex?breakDraft:item)};
    const start = timeToMinutes(breakDraft.Inicio);
    const end = timeToMinutes(breakDraft.Fim);
    if (!breakDraft.Inicio || !breakDraft.Fim || !Number.isFinite(start) || !Number.isFinite(end) || start >= end || hasIntervaloInvalido(candidate)) {
      showNotification({type:"warning",title:t("hours.breakInvalid"),message:t("hours.breakOutside")});
      return;
    }
    if (hasIntervaloSobreposto(candidate)) {
      showNotification({type:"warning",title:t("hours.overlapTitle"),message:t("hours.overlap")});
      return;
    }
    if (getPausaTotal(candidate) >= timeToMinutes(candidate.HorarioFechamento)-timeToMinutes(candidate.HorarioAbertura)) {
      showNotification({type:"warning",title:t("hours.noAvailabilityTitle"),message:t("hours.noAvailability")});
      return;
    }
    if(await handleSubmit("breaks",candidate.Intervalos)) setBreakDraft(null);
  }

  async function removeIntervalo(index:number) {
    if (!config || saving) return;
    await handleSubmit("breaks",config.Intervalos.filter((_,currentIndex)=>currentIndex!==index));
  }

  async function handleSubmit(block:ConfigBlock, nextBreaks?:FuncionamentoIntervalo[]):Promise<boolean> {
    if(saving || !config) return false;
    // Merge only this card into the last confirmed server state.
    const draft = config;
    const baseline = savedSnapshot ?? criarFuncionamentoPadrao(usuarioId);
    const candidate = { ...baseline, ...blockPatch(block,draft), ...(block==="breaks" && nextBreaks ? {Intervalos:nextBreaks} : {}) };
    if(block==="custom" || block==="availability") {
      // A new exception cannot be persisted for a day that is not yet enabled.
      if(DIAS.some(d=>candidate.HorariosPorDia?.[d.key] && !baseline[d.key] && draft[d.key])) {
        showNotification({type:"warning",title:"Dias de atendimento",message:"Salve os dias de atendimento antes de salvar os horários personalizados."});
        return false;
      }
    }
    const diasSelecionados = DIAS.filter(dia=>candidate[dia.key]);
    const pausaTotal = getPausaTotal(candidate);
    const expedienteTotal = timeToMinutes(candidate.HorarioFechamento)-timeToMinutes(candidate.HorarioAbertura);

    if (!candidate || !usuarioId) {
      const message = t("hours.userMissing");
      showNotification({ type: "error", title: t("hours.notSaved"), message });
      return false;
    }

    if (diasSelecionados.length === 0) {
      const message = t("hours.daysRequired");
      showNotification({ type: "warning", title: t("hours.noDays"), message });
      return false;
    }

    if (!candidate.HorarioAbertura || !candidate.HorarioFechamento) {
      const message = t("hours.timeRequired");
      showNotification({ type: "warning", title: t("hours.timeIncomplete"), message });
      return false;
    }

    if (timeToMinutes(candidate.HorarioAbertura) >= timeToMinutes(candidate.HorarioFechamento)) {
      const message = t("hours.timeInvalidDesc");
      showNotification({ type: "warning", title: t("hours.timeInvalid"), message });
      return false;
    }

    if (hasIntervaloInvalido(candidate)) {
      const message = t("hours.breakOutside");
      showNotification({ type: "warning", title: t("hours.breakInvalid"), message });
      return false;
    }

    if (hasIntervaloSobreposto(candidate)) {
      const message = t("hours.overlap");
      showNotification({ type: "warning", title: t("hours.overlapTitle"), message });
      return false;
    }

    if (pausaTotal >= expedienteTotal) {
      const message = t("hours.noAvailability");
      showNotification({ type: "warning", title: t("hours.noAvailabilityTitle"), message });
      return false;
    }

    for (const dia of diasSelecionados) {
      const especial = candidate.HorariosPorDia?.[dia.key];
      if (!especial) continue;
      const abertura = timeToMinutes(especial.Inicio);
      const fechamento = timeToMinutes(especial.Fim);
      const diario = { ...candidate, HorarioAbertura: especial.Inicio,
        HorarioFechamento: especial.Fim, Intervalos: especial.Intervalos };
      if (!especial.Inicio || !especial.Fim || abertura >= fechamento ||
          hasIntervaloInvalido(diario) || hasIntervaloSobreposto(diario) ||
          getPausaTotal(diario) >= fechamento - abertura) {
        const message = `${t("hours.reviewDay")} ${[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(d => d.key === dia.key)]}.`;
        showNotification({ type: "warning", title: t("hours.specificInvalid"), message });
        return false;
      }
    }

    try {
      setSaving(true);
      setSavingBlock(block);
      const savedConfig = await salvarFuncionamento(usuarioId, candidate);
      setSavedSnapshot(savedConfig);
      if(block==="availability" || block==="custom") setSavedMode(availabilityMode);
      setConfig(current => {
        if(!current)return savedConfig;
        // Preserve pending changes in other cards, including changes made during the request.
        const next = {...savedConfig};
        for(const other of ["days","times","breaks","custom"] as const) {
          if(other==="breaks" && block==="breaks" && nextBreaks) continue;
          const previous = blockPatch(other,baseline);
          const local = blockPatch(other,current);
          const submitted = blockPatch(other,candidate);
          if(JSON.stringify(local)!==JSON.stringify(previous) && JSON.stringify(local)!==JSON.stringify(submitted)) Object.assign(next,local);
        }
        return next;
      });
      lastSavedConfig.current = JSON.stringify(savedConfig);

      showNotification({
        type: "success",
        title: t("hours.saved"),
        message: t("hours.savedDesc"),
      });
      return true;
    } catch (err) {
      const message = isAxiosError<ApiError>(err)
        ? getApiErrorMessage(err.response?.data, t("hours.saveError"))
        : t("hours.saveError");
      showNotification({ type: "error", title: t("hours.saveFailedTitle"), message });
      return false;
    } finally {
      setSaving(false);
      setSavingBlock(null);
    }
  }

  const isDirty = (block:ConfigBlock) => {
    if(!config)return false;
    if(block==="availability" && availabilityMode!==savedMode)return true;
    if((block==="availability"||block==="custom") && block!==customOwner)return false;
    return JSON.stringify(blockPatch(block,config))!==JSON.stringify(blockPatch(block,savedSnapshot??criarFuncionamentoPadrao(usuarioId)));
  };
  const saveAction = (block:ConfigBlock) => <div style={{minHeight:48,marginTop:14,display:"flex",justifyContent:"flex-end"}}>
    <button type="button" className={styles.saveButton} onClick={()=>void handleSubmit(block)} disabled={saving||!isDirty(block)} style={{visibility:isDirty(block)||savingBlock===block?"visible":"hidden",backgroundColor:theme.colors.primary,color:theme.colors.onPrimary,minWidth:0,width:"100%"}}>
      <FaSave aria-hidden="true"/> {savingBlock===block?t("profile.saving"):t("hours.save")}
    </button>
  </div>;

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>
      <div className={styles.content} style={{gridTemplateColumns:"minmax(0,1fr)"}}>
        <form id="funcionamento-form" className={styles.editor} onSubmit={event=>event.preventDefault()} noValidate>
          {loading || !config ? (
            <LoadingState label={t("hours.loading")} variant="hours" embedded />
          ) : (
            <>
              <details className={styles.configCard}>
                <summary className={styles.configToggle}><FaSlidersH aria-hidden="true"/><span>{"Disponibilidade de atendimento"}</span><FaChevronDown aria-hidden="true"/></summary>
                <div className={styles.configBody}>
                  <div className={styles.availabilityOptions}>
                  <button type="button" disabled={loading || saving || !config} aria-pressed={!temHorariosPersonalizados}
                    onClick={() => chooseAvailabilityMode("padrao")}
                    className={`${styles.availabilityOption} ${!temHorariosPersonalizados ? styles.availabilitySelected : ""}`}>
                    <FaCalendarAlt aria-hidden="true" />
                    <span><strong>Horário padrão</strong><small>Mesmo horário para todos os dias selecionados</small></span>
                  </button>
                  <button type="button" disabled={loading || saving || !config} aria-pressed={temHorariosPersonalizados}
                    onClick={() => chooseAvailabilityMode("personalizado")}
                    className={`${styles.availabilityOption} ${temHorariosPersonalizados ? styles.availabilitySelected : ""}`}>
                    <FaSlidersH aria-hidden="true" />
                    <span><strong>Horários personalizados</strong><small>Personalize apenas os dias com horários diferentes</small></span>
                  </button>
                </div>
                  {saveAction("availability")}

                </div>
              </details>
              <details className={styles.configCard}>
                <summary className={styles.configToggle}><FaCalendarAlt aria-hidden="true"/><span>{t("hours.daysTitle")}</span><FaChevronDown aria-hidden="true"/></summary>
                <div className={styles.configBody}>
                  <div className={styles.cardHeader}><div className={styles.presets} aria-label={t("hours.quickSelect")}>
                    <button type="button" onClick={() => setDiasSelecionados(DIAS_UTEIS)}>{t("hours.weekdays")}</button>
                    <button type="button" onClick={() => setDiasSelecionados(new Set(DIAS.map((dia) => dia.key)))}>{t("hours.allDays")}</button>
                    <button type="button" onClick={() => setDiasSelecionados(new Set())}>{t("hours.none")}</button>
                  </div>
                </div>

                <div className={styles.daysGrid}>
                  {DIAS.map((dia) => {
                    const active = config[dia.key];
                    return (
                      <button
                        key={dia.key}
                        type="button"
                        className={`${styles.dayButton} ${active ? styles.dayButtonActive : ""}`}
                        onClick={() => toggleDia(dia.key)}
                        aria-pressed={active}
                        aria-label={`${[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)]}: ${active ? t("hours.selected") : t("hours.notSelected")}`}
                        style={{
                          borderColor: active ? theme.colors.primary : theme.colors.bottom,
                          color: active ? theme.colors.text : theme.colors.inactive,
                          backgroundColor: active ? theme.colors.primary : "transparent",
                        }}
                      >
                        <strong>{[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)].slice(0,3)}</strong>
                        <span className={styles.dayFullName}>{[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)]}</span>
                      </button>
                    );
                  })}
                </div>
                  <div className={styles.schedulePreview}>
                    {diasSelecionados.map(dia => <div key={dia.key}><span>{[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(d=>d.key===dia.key)]}</span><strong>{horariosPorDia[dia.key]?.Inicio ?? config.HorarioAbertura} – {horariosPorDia[dia.key]?.Fim ?? config.HorarioFechamento}</strong></div>)}
                  </div>
                  {saveAction("days")}

                </div>
              </details>

              <details className={styles.configCard}>
                <summary className={styles.configToggle}><FaClock aria-hidden="true"/><span>{t("hours.timeTitle")}</span><FaChevronDown aria-hidden="true"/></summary>
                <div className={styles.configBody}>
                  <div className={styles.cardHeader}><span className={styles.duration} style={{ color: theme.colors.primary }}>
                    <FaClock aria-hidden="true" /> {formatDuration(expedienteTotal)}
                  </span>
                </div>

                <p className={styles.scheduleHint}>Horário padrão dos dias selecionados. Os dias personalizados mantêm seus próprios horários.</p>
                <div className={styles.timeRange}>
                  <label style={{ color: theme.colors.text }}>
                    {t("hours.open")}
                    <input
                      type="time"
                      value={config.HorarioAbertura}
                      onChange={(event) => updateConfig({ HorarioAbertura: event.target.value })}
                      step="900"
                      required
                    />
                  </label>
                  <FaArrowRight className={styles.timeArrow} aria-hidden="true" />
                  <label style={{ color: theme.colors.text }}>
                    {t("hours.end")}
                    <input
                      type="time"
                      value={config.HorarioFechamento}
                      onChange={(event) => updateConfig({ HorarioFechamento: event.target.value })}
                      step="900"
                      required
                    />
                  </label>
                </div>
                  {saveAction("times")}

                </div>
              </details>

              

              <details className={styles.configCard}>
                <summary className={styles.configToggle}><FaCoffee aria-hidden="true"/><span>{t("hours.breaksTitle")}</span><FaChevronDown aria-hidden="true"/></summary>
                <div className={styles.configBody}>
                  <div className={styles.cardHeader}><button type="button" className={styles.addButton} disabled={saving} onClick={addIntervalo}>
                    <FaPlus aria-hidden="true" /> {t("hours.breakAdd")}
                  </button>
                </div>

                {config.Intervalos.length === 0 ? (
                  <div className={styles.emptyState} style={{ borderColor: theme.colors.bottom }}>
                    <FaCoffee aria-hidden="true" />
                    <div>
                      <strong style={{ color: theme.colors.text }}>{t("hours.noBreaks")}</strong>
                      <span style={{ color: theme.colors.inactive }}>{t("hours.continuous")}</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.intervalList}>
                    {config.Intervalos.map((intervalo, index) => (
                      <BreakCard key={index} interval={intervalo} index={index} onEdit={()=>{setEditingBreakIndex(index);setBreakDraft({...intervalo});}} startLabel={t("hours.start")} endLabel={t("hours.finish")} min={config.HorarioAbertura} max={config.HorarioFechamento} busy={saving} onRemove={()=>removeIntervalo(index)}/>
                    ))}
                  </div>
                )}


                </div>
              </details>
            </>
          )}
        </form>

        
      </div>
      {customModalOpen && config && createPortal(
        <Modal open busy={saving} title="Horários personalizados" onClose={closeCustomModal} actions={<>
          <button type="button" className={styles.addButton} disabled={saving} onClick={closeCustomModal}>{t("common.cancel")}</button>
          <button type="button" className={styles.saveButton} style={{backgroundColor:theme.colors.primary,color:theme.colors.onPrimary,minWidth:0}} disabled={saving} onClick={confirmCustomModal}><FaSave aria-hidden="true"/> Aplicar alterações</button>
        </>}>
          <div className={styles.customModalContent}>
            <p className={styles.scheduleHint}>Personalize somente os dias que fogem do horário padrão. Ex.: sábado até 12:00.</p>
                  <div className={styles.dayHoursList}>
                  {diasSelecionados.map(dia => {
                    const horario = horariosPorDia[dia.key];
                    const inicio = horario?.Inicio ?? config.HorarioAbertura;
                    const fim = horario?.Fim ?? config.HorarioFechamento;
                    return <div key={dia.key} className={styles.dayHoursRow}>
                      <div className={styles.dayHoursIdentity}>
                        <strong>{[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)]}</strong>
                        <span>{inicio} – {fim}{horario ? ` · ${t("hours.custom")}` : ` · ${t("hours.default")}`}</span>
                      </div>
                      <button type="button" className={styles.customizeButton}
                        onClick={() => personalizarDia(dia.key)}
                        aria-expanded={Boolean(horario)}>
                        {horario ? t("hours.useDefault") : t("hours.customize")}
                      </button>
                      {horario && <div className={styles.dayHoursEditor}>
                        <label>{t("hours.open")}
                          <input type="time" value={horario.Inicio} step="900"
                            onChange={event => alterarHorarioDia(dia.key, "Inicio", event.target.value)} />
                        </label>
                        <label>{t("hours.end")}
                          <input type="time" value={horario.Fim} step="900"
                            onChange={event => alterarHorarioDia(dia.key, "Fim", event.target.value)} />
                        </label>
                        <div className={styles.dayPauses}>
                          <div className={styles.dayPausesHeader}>
                            <span>{t("hours.breaksDay")}</span>
                            <button type="button" onClick={() => adicionarPausaDia(dia.key)}>+ {t("hours.addBreak")}</button>
                          </div>
                          {horario.Intervalos.map((pausa, index) =>
                            <div className={styles.dayPauseRow} key={index}>
                              <input aria-label={`Início da pausa ${index + 1} de ${[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)]}`}
                                type="time" value={pausa.Inicio} step="900"
                                onChange={event => alterarPausaDia(dia.key, index, "Inicio", event.target.value)} />
                              <span>{t("hours.until")}</span>
                              <input aria-label={`Fim da pausa ${index + 1} de ${[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)]}`}
                                type="time" value={pausa.Fim} step="900"
                                onChange={event => alterarPausaDia(dia.key, index, "Fim", event.target.value)} />
                              <button type="button" onClick={() => removerPausaDia(dia.key, index)}
                                aria-label={`Remover pausa ${index + 1} de ${[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)]}`}><FaTrash aria-hidden="true" /></button>
                            </div>
                          )}
                          {!horario.Intervalos.length && <small>{t("hours.noBreaksDay")}</small>}
                        </div>
                      </div>}
                    </div>;
                  })}
                  {!diasSelecionados.length && <p>{t("hours.selectDays")}</p>}
                </div>
          </div>
        </Modal>,document.body)}
      {breakDraft && config && createPortal(<Modal open busy={saving} title={editingBreakIndex===null?t("hours.breakAdd"):"Editar pausa"} onClose={()=>setBreakDraft(null)} actions={<><button type="button" className={styles.addButton} disabled={saving} onClick={()=>setBreakDraft(null)}>{t("common.cancel")}</button><button type="button" className={styles.saveButton} style={{backgroundColor:theme.colors.primary,color:theme.colors.onPrimary,minWidth:0}} disabled={saving} onClick={confirmBreak}>{editingBreakIndex===null?<FaPlus aria-hidden="true"/>:<FaSave aria-hidden="true"/>}{editingBreakIndex===null?t("hours.breakAdd"):"Salvar alterações"}</button></>}>
        <label className={styles.breakTypeField}>Tipo de intervalo
          <select value={breakDraft.Tipo??"OUTRO"} onChange={event=>setBreakDraft(previous=>previous?{...previous,Tipo:event.target.value as TipoPausa}:null)}>
            {BREAK_TYPES.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className={styles.breakFields}>
          <label>{t("hours.start")}<input type="time" value={breakDraft.Inicio} min={config.HorarioAbertura} max={config.HorarioFechamento} step="900" onChange={e=>setBreakDraft(previous=>previous?{...previous,Inicio:e.target.value}:null)}/></label>
          <label>{t("hours.finish")}<input type="time" value={breakDraft.Fim} min={config.HorarioAbertura} max={config.HorarioFechamento} step="900" onChange={e=>setBreakDraft(previous=>previous?{...previous,Fim:e.target.value}:null)}/></label>
        </div>
      </Modal>,document.body)}
    </main>
  );
}
