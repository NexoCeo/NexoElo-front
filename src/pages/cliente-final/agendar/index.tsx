import { formatPersonName } from "@/context/UserContext";
import LoadingState from "@/components/loading-state";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useMemo, useState } from "react";
import { usePageRevalidation } from "@/hooks/usePageRevalidation";
import { isAxiosError } from "axios";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FaBuilding,
  FaCalendarAlt,
  FaCheck,
  FaArrowLeft,
  FaArrowRight,
  FaSearch,
  FaClock,
  FaImage,
  FaUser,
} from "react-icons/fa";
import {
  criarAgendamento,
  listarHorariosDisponiveis,
  listarProfissionaisAgendamento,
  listarResponsaveisAgendamento,
} from "@/services/agendamento-service";
import { obterAgendaPublica } from "@/services/agenda-publica-service";
import {
  calcularTotalOnline, consultarPagamentoPublico, iniciarPagamentoOnline, registrarPagamentoPresencial,
  type ConfiguracaoPagamento
} from "@/services/pagamentos-agendamento-service";
import { getClienteFinalUser } from "@/services/cliente-final-auth-token";
import {
  listarServicosPorEmpresa,
  listarServicosPorProfissional,
} from "@/services/servico-service";
import type {
  HorarioDisponivel,
  ProfissionalAgendamento,
  ResponsavelAgendamento,
} from "@/types/agendamento";
import type { Servico } from "@/types/servico";
import {
  defaultProfileImg,
  getProfileImageUrl,
  getUploadedImageUrl,
} from "@/components/header/profile-image";
import styles from "./style.module.css";
import { useLanguage } from "@/context/LanguageContext";
import { useNotification } from "@/context/NotificationContext";

type ApiError = string | {
  erro?: string;
  message?: string;
  title?: string;
};

type BookingSection = "responsavel" | "profissional" | "servico" | "horario" | "confirmacao";

type SelectedService = { profissionalId: number; servico: Servico };
type BookingDraft = {
  selecoes?: SelectedService[];
  responsavelId: number;
  profissionalId: number;
  servicoId: number;
  servicoIds?: number[];
  dataSelecionada: string;
  dataAgendamento: string;
  expandedSection: BookingSection;
};

const bookingSections: BookingSection[] = ["responsavel", "profissional", "servico", "horario", "confirmacao"];

function readBookingDraft(key: string): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    const draft = saved as Partial<BookingDraft>;
    if (![draft.responsavelId, draft.profissionalId, draft.servicoId].every(
      (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    )) return null;
    if (typeof draft.dataSelecionada !== "string" ||
        (draft.dataSelecionada !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(draft.dataSelecionada)) ||
        typeof draft.dataAgendamento !== "string" ||
        typeof draft.expandedSection !== "string" ||
        !bookingSections.includes(draft.expandedSection as BookingSection)) return null;
    if (draft.servicoIds !== undefined && (!Array.isArray(draft.servicoIds) || !draft.servicoIds.every(id => Number.isSafeInteger(id) && id > 0))) return null;
    if (draft.selecoes && (!Array.isArray(draft.selecoes) || !draft.selecoes.every(item => Number.isSafeInteger(item.profissionalId) && item.profissionalId > 0 && Number.isSafeInteger(item.servico?.Id)))) return null;
    return draft as BookingDraft;
  } catch {
    return null;
  }
}


function getApiError(data?: ApiError) {
  if (!data) {
    return "Nao foi possivel criar o agendamento.";
  }

  if (typeof data === "string") {
    return data;
  }

  return data.erro || data.message || data.title || "Nao foi possivel criar o agendamento.";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function toDateInputValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

function ProfilePhoto({ source, name }: { source?: string; name: string }) {
  return (
    <span className={styles.profilePhoto}>
      <img
        src={getProfileImageUrl(source)}
        alt={`Foto de ${name}`}
        onError={(event) => {
          if (!event.currentTarget.src.endsWith(defaultProfileImg)) {
            event.currentTarget.src = defaultProfileImg;
          }
        }}
      />
    </span>
  );
}

function ServicePhoto({ source, name }: { source?: string; name: string }) {
  const imageUrl = getUploadedImageUrl(source);

  return (
    <span className={styles.servicePhoto}>
      <FaImage aria-hidden="true" />
      {imageUrl && (
        <img
          src={imageUrl}
          alt={`Imagem do servico ${name}`}
          onError={(event) => event.currentTarget.remove()}
        />
      )}
    </span>
  );
}

export default function ClienteFinalAgendar() {
  const { themeName } = useTheme();
  const { t, lang } = useLanguage();
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const cliente = getClienteFinalUser();
  const storageKey = `nexoelo-booking-draft:${cliente?.Id ?? "guest"}:${username ?? "marketplace"}`;
  const [draft] = useState(() => readBookingDraft(storageKey));
  const [responsaveis, setResponsaveis] = useState<ResponsavelAgendamento[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalAgendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<HorarioDisponivel[]>([]);
  const [responsavelId, setResponsavelId] = useState(draft?.responsavelId ?? 0);
  const [profissionalId, setProfissionalId] = useState(draft?.profissionalId ?? 0);
  const [selecoes, setSelecoes] = useState<SelectedService[]>(draft?.selecoes ?? []);
  const [servicoIds, setServicoIds] = useState<number[]>(draft?.selecoes?.length ? draft.selecoes.map(item => item.servico.Id) : draft?.servicoIds?.length ? draft.servicoIds : draft?.servicoId ? [draft.servicoId] : []);
  const servicoId = servicoIds[0] ?? 0;
  const [dataSelecionada, setDataSelecionada] = useState(draft?.dataSelecionada ?? "");
  const [dataAgendamento, setDataAgendamento] = useState(draft?.dataAgendamento ?? "");
  const [refreshHorarios, setRefreshHorarios] = useState(0);
  const [loading, setLoading] = useState(false);
  const [configPagamento, setConfigPagamento] = useState<ConfiguracaoPagamento | null>(null);
  const [loadingPagamento, setLoadingPagamento] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<"PRESENCIAL" | "ONLINE">("PRESENCIAL");
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false);
  const [loadingProfissionais, setLoadingProfissionais] = useState(false);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSection, setExpandedSection] = useState<BookingSection | null>(draft?.expandedSection ?? "responsavel");
  const [buscaPrestador, setBuscaPrestador] = useState("");
  const [filtroPrestador, setFiltroPrestador] = useState<"TODOS" | "EMPRESA" | "AUTONOMO">("TODOS");
  usePageRevalidation(() => setRefreshHorarios(value => value + 1), {
    enabled: Boolean(dataSelecionada) && Boolean(servicoId) && !loading,
  });


  const selectedResponsavel = responsaveis.find(
    (responsavel) => responsavel.Id === responsavelId,
  );
  const selectedHorario = horariosDisponiveis.find(
    (horario) => horario.DataAgendamento === dataAgendamento,
  );
  const selectedProfissional = profissionais.find(
    (profissional) => profissional.Id === profissionalId,
  );
  const selectedServicos = responsavelId && selectedResponsavel?.TipoUsuario === "EMPRESA" && selecoes.length
    ? selecoes.map(item => item.servico)
    : servicoIds.map(id => servicos.find(servico => servico.Id === id)).filter((servico): servico is Servico => Boolean(servico));
  const atendimentos = selecoes.map(item => ({ ServicoId: item.servico.Id, ProfissionalId: item.profissionalId }));
  const multiplosProfissionais = new Set(atendimentos.map(item => item.ProfissionalId)).size > 1;
  const totalValor = selectedServicos.reduce((total, servico) => total + Number(servico.Valor || 0), 0);
  const totalOnline = configPagamento ? calcularTotalOnline(totalValor, configPagamento) : null;
  const totalDuracao = selectedServicos.reduce((total, servico) => total + Number(servico.TempoEstimadoMinutos || 0), 0);
  const responsavelEhEmpresa = selectedResponsavel?.TipoUsuario === "EMPRESA";
  const minDate = useMemo(() => toDateInputValue(new Date()), []);
  const returnUrl = location.pathname + location.search;
  const loginUrl = "/cliente-final/login?redirectTo=" + encodeURIComponent(returnUrl);
  const prestadoresFiltrados = responsaveis.filter((item) =>
    item.Nome.toLocaleLowerCase("pt-BR").includes(buscaPrestador.trim().toLocaleLowerCase("pt-BR")) &&
    (filtroPrestador === "TODOS" || item.TipoUsuario === filtroPrestador),
  );
  const etapaAtual = expandedSection ?? "confirmacao";
  useEffect(() => {
    try {
      if (success) {
        sessionStorage.removeItem(storageKey);
      } else {
        sessionStorage.setItem(storageKey, JSON.stringify({
          responsavelId, profissionalId, servicoId, servicoIds, selecoes, dataSelecionada,
          dataAgendamento, expandedSection: etapaAtual,
        } satisfies BookingDraft));
      }
    } catch {
      // O agendamento continua funcionando mesmo com armazenamento indisponivel.
    }
  }, [storageKey, responsavelId, profissionalId, servicoId, servicoIds, selecoes, dataSelecionada, dataAgendamento, etapaAtual, success]);

  useEffect(() => {
    if (!responsavelId) { setConfigPagamento(null); return; }
    let active = true;
    setLoadingPagamento(true);
    setConfigPagamento(null);
    void consultarPagamentoPublico(responsavelId)
      .then(config => {
        if (!active) return;
        setConfigPagamento(config);
        setMetodoPagamento(config.Modalidade === "ONLINE" ? "ONLINE" : "PRESENCIAL");
      })
      .catch(() => {
        if (active) showNotification({
          type: "error", title: "Pagamento indisponível",
          message: "Não foi possível consultar as formas de pagamento deste estabelecimento."
        });
      })
      .finally(() => { if(active) setLoadingPagamento(false); });
    return () => { active = false; };
  }, [responsavelId, showNotification]);

  const dataFormatada = dataSelecionada ? new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : "en-US", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(dataSelecionada + "T12:00:00")) : "";

  useEffect(() => {
    let active = true;

    async function loadResponsaveis() {
      try {
        setLoadingResponsaveis(true);
        setError("");
        const data = username
          ? [await obterAgendaPublica(username)].map((agenda) => ({
              Id: agenda.UsuarioId,
              Nome: agenda.Nome,
              Email: "",
              Telefone: "",
              TipoUsuario: agenda.TipoUsuario,
              Slug: agenda.Slug,
              FotoPerfil: agenda.FotoPerfil,
            }))
          : await listarResponsaveisAgendamento();

        if (active) {
          setResponsaveis(data);
          if (username && data[0]) {
            if (draft?.responsavelId !== data[0].Id) {
              setResponsavelId(data[0].Id);
              setProfissionalId(0);
              setServicoIds([]);
              setSelecoes([]);
              setDataSelecionada("");
              setDataAgendamento("");
              setExpandedSection(data[0].TipoUsuario === "EMPRESA" ? "profissional" : "servico");
            }
          } else if (draft?.responsavelId && !data.some(item => item.Id === draft.responsavelId)) {
            setResponsavelId(0);
            setProfissionalId(0);
            setServicoIds([]);
            setDataSelecionada("");
            setDataAgendamento("");
            setExpandedSection("responsavel");
          }
        }
      } catch {
        if (active) {
          const message = "Nao foi possivel carregar os prestadores.";
          setError(message);
          showNotification({ type: "error", title: "Prestadores indisponiveis", message });
        }
      } finally {
        if (active) {
          setLoadingResponsaveis(false);
        }
      }
    }

    void loadResponsaveis();

    return () => {
      active = false;
    };
  }, [showNotification, username]);

  useEffect(() => {
    let active = true;

    setProfissionais([]);

    if (!responsavelId || !responsavelEhEmpresa) {
      setLoadingProfissionais(false);
      return () => {
        active = false;
      };
    }

    async function loadProfissionais() {
      try {
        setLoadingProfissionais(true);
        setError("");
        const data = await listarProfissionaisAgendamento(responsavelId);

        if (active) {
          setProfissionais(data);
          if (profissionalId && !data.some(item => item.Id === profissionalId)) {
            setProfissionalId(0);
            setServicoIds([]);
            setDataSelecionada("");
            setDataAgendamento("");
            setExpandedSection("profissional");
          }
        }
      } catch {
        if (active) {
          const message = "Nao foi possivel carregar os profissionais da empresa.";
          setError(message);
          showNotification({ type: "error", title: "Profissionais indisponiveis", message });
        }
      } finally {
        if (active) {
          setLoadingProfissionais(false);
        }
      }
    }

    void loadProfissionais();

    return () => {
      active = false;
    };
  }, [responsavelEhEmpresa, responsavelId, showNotification]);

  useEffect(() => {
    let active = true;

    setServicos([]);

    if (!responsavelId || !selectedResponsavel || (responsavelEhEmpresa && (!profissionalId || !selectedProfissional))) {
      setLoadingServicos(false);
      return () => {
        active = false;
      };
    }

    async function loadServicos() {
      try {
        setLoadingServicos(true);
        setError("");

        const data = responsavelEhEmpresa
          ? await listarServicosPorProfissional(profissionalId, responsavelId)
          : await listarServicosPorEmpresa(responsavelId);

        if (active) {
          setServicos(data);
          if (!responsavelEhEmpresa) {
            const validos = servicoIds.filter(id => data.some(item => item.Id === id));
            if (validos.length !== servicoIds.length) {
              setServicoIds(validos);
              resetSchedule();
              setExpandedSection("servico");
            }
          } else {
            // Outros profissionais mantêm suas seleções ao trocar de catálogo.
            setSelecoes(previous => {
              const validos = previous.filter(item =>
                item.profissionalId !== profissionalId || data.some(servico => servico.Id === item.servico.Id));
              if (validos.length !== previous.length) {
                setServicoIds(validos.map(item => item.servico.Id));
                setDataAgendamento("");
              }
              return validos;
            });
          }
        }
      } catch {
        if (active) {
          const message = "Nao foi possivel carregar os servicos.";
          setError(message);
          showNotification({ type: "error", title: "Servicos indisponiveis", message });
        }
      } finally {
        if (active) {
          setLoadingServicos(false);
        }
      }
    }

    void loadServicos();

    return () => {
      active = false;
    };
  }, [profissionalId, responsavelEhEmpresa, responsavelId, selectedResponsavel, selectedProfissional, showNotification]);

  useEffect(() => {
    let active = true;

    setHorariosDisponiveis([]);

    if (
      !responsavelId ||
      !selectedResponsavel ||
      !servicoId ||
      selectedServicos.length !== servicoIds.length ||
      !dataSelecionada ||
      (responsavelEhEmpresa && !profissionalId)
    ) {
      setLoadingHorarios(false);
      return () => {
        active = false;
      };
    }

    async function loadHorarios() {
      try {
        setLoadingHorarios(true);
        setError("");
        const data = await listarHorariosDisponiveis({
          responsavelId,
          profissionalId: responsavelEhEmpresa ? profissionalId : undefined,
          servicoId,
          servicoIds,
          atendimentos: responsavelEhEmpresa ? atendimentos : undefined,
          data: dataSelecionada,
        });

        if (active) {
          setHorariosDisponiveis(data);
          if (dataAgendamento && !data.some(item => item.DataAgendamento === dataAgendamento)) {
            setDataAgendamento("");
            setExpandedSection("horario");
          }
        }
      } catch {
        if (active) {
          const message = "Nao foi possivel carregar os horarios disponiveis.";
          setError(message);
          showNotification({ type: "error", title: "Horarios indisponiveis", message });
        }
      } finally {
        if (active) {
          setLoadingHorarios(false);
        }
      }
    }

    void loadHorarios();

    return () => {
      active = false;
    };
  }, [
    dataSelecionada,
    profissionalId,
    refreshHorarios,
    responsavelEhEmpresa,
    responsavelId,
    selectedResponsavel,
    // Ao restaurar um rascunho os serviços chegam após o prestador.
    // Revalidar a disponibilidade quando o catálogo terminar de carregar.
    servicos,
    servicoIds.join(','),
    selecoes.map(item => `${item.profissionalId}:${item.servico.Id}`).join(','),
    servicoId,
    showNotification,
  ]);

  function resetSchedule() {
    setDataSelecionada("");
    setDataAgendamento("");
    setHorariosDisponiveis([]);
  }

  function handleResponsavelChange(nextResponsavelId: number) {
    const nextResponsavel = responsaveis.find(
      (responsavel) => responsavel.Id === nextResponsavelId,
    );
    setResponsavelId(nextResponsavelId);
    setProfissionais([]);
    setProfissionalId(0);
    setServicos([]);
    setServicoIds([]);
    setSelecoes([]);
    resetSchedule();
    setError("");
    setSuccess("");
    setExpandedSection(nextResponsavel?.TipoUsuario === "EMPRESA" ? "profissional" : "servico");
  }

  function handleProfissionalChange(nextProfissionalId: number) {
    setProfissionalId(nextProfissionalId);
    setServicos([]);
    // Preserva serviços escolhidos dos outros profissionais.
    resetSchedule();
    setError("");
    setSuccess("");
    setExpandedSection("servico");
  }

  function handleServicoChange(nextServicoId: number) {
    if (responsavelEhEmpresa) {
      const escolhido = servicos.find(item => item.Id === nextServicoId);
      if (!escolhido || !profissionalId) return;
      const existente = selecoes.some(item => item.servico.Id === nextServicoId);
      const proximas = existente
        ? selecoes.filter(item => item.servico.Id !== nextServicoId)
        : [...selecoes, { profissionalId, servico: escolhido }];
      if (proximas.length > 12) {
        showNotification({ type: "warning", title: "Limite de serviços", message: "Selecione até 12 serviços por agendamento." });
        return;
      }
      setSelecoes(proximas);
      setServicoIds(proximas.map(item => item.servico.Id));
    } else {
      setServicoIds(current => current.includes(nextServicoId)
        ? current.filter(id => id !== nextServicoId)
        : [...current, nextServicoId]);
    }
    resetSchedule();
    setError("");
    setSuccess("");
  }

  function advanceToSchedule() {
    if (servicoIds.length === 0) {
      showNotification({ type: "warning", title: "Selecione um serviço", message: "Escolha pelo menos um atendimento." });
      return;
    }
    setExpandedSection("horario");
  }

  function handleDataChange(nextDate: string) {
    setDataSelecionada(nextDate);
    setDataAgendamento("");
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!cliente?.Id) {
      navigate(loginUrl);
      return;
    }

    if (!responsavelId) {
      const message = "Selecione um autonomo ou uma empresa.";
      setError(message);
      showNotification({ type: "warning", title: "Prestador nao selecionado", message });
      return;
    }

    if (responsavelEhEmpresa && !profissionalId) {
      const message = "Selecione o profissional que vai atender.";
      setError(message);
      showNotification({ type: "warning", title: "Profissional nao selecionado", message });
      return;
    }

    if (!servicoId) {
      const message = "Selecione um servico.";
      setError(message);
      showNotification({ type: "warning", title: "Servico nao selecionado", message });
      return;
    }

    if (!dataAgendamento || !selectedHorario) {
      const message = "Selecione um dos horarios disponiveis.";
      setError(message);
      showNotification({ type: "warning", title: "Horario nao selecionado", message });
      return;
    }

    if (!configPagamento || loadingPagamento ||
        (metodoPagamento === "ONLINE" && !configPagamento.OnlineDisponivel) ||
        (metodoPagamento === "PRESENCIAL" && configPagamento.Modalidade === "ONLINE")) {
      showNotification({type:"warning",title:"Selecione a forma de pagamento",message:"Esta modalidade não está disponível para o estabelecimento."});
      return;
    }

    try {
      setLoading(true);
      const criado = await criarAgendamento({
        ClienteId: cliente.Id,
        ResponsavelId: responsavelId,
        ProfissionalId: responsavelEhEmpresa ? (selecoes[0]?.profissionalId ?? profissionalId) : undefined,
        Atendimentos: responsavelEhEmpresa && selecoes.length ? atendimentos : undefined,
        ServicoId: servicoId,
        ServicoIds: servicoIds,
        DataAgendamento: dataAgendamento,
      });
      // A reserva existe antes do encaminhamento à Stripe.
      // Caso o checkout falhe, o cliente poderá retomar o pagamento no histórico.
      const data = criado as {Id?:number;id?:number};
      const idCriado = Number(data.Id ?? data.id);
      try {
        if (!Number.isInteger(idCriado) || idCriado <= 0) throw new Error("ID do agendamento indisponível.");
        if (metodoPagamento === "ONLINE") {
          await iniciarPagamentoOnline(idCriado);
          return;
        }
        await registrarPagamentoPresencial(idCriado);
      } catch {
        showNotification({
          type:"warning", title:"Agendamento criado",
          message:"A reserva foi feita, mas não foi possível registrar o pagamento. Consulte seu histórico para continuar."
        });
        navigate("/cliente-final/home", { replace: true });
        return;
      }
      // O agendamento foi confirmado pela API: nao manter o rascunho,
      // nem exibir uma etapa intermediaria de sucesso.
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // O redirecionamento nao depende do armazenamento do navegador.
      }
      showNotification({
        type: "success",
        title: "Agendamento confirmado",
        message: "Seu novo horario ja aparece no historico.",
      });
      navigate("/cliente-final/home", { replace: true });
    } catch (err) {
      if (isAxiosError<ApiError>(err)) {
        const message = getApiError(err.response?.data);
        setError(message);
        showNotification({ type: "error", title: "Agendamento nao criado", message });
      } else {
        const message = "Nao foi possivel criar o agendamento.";
        setError(message);
        showNotification({ type: "error", title: "Agendamento nao criado", message });
      }
      setRefreshHorarios((current) => current + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.marketplace}>
      {!responsavelId && (
        <button type="button" className={styles.backToProviders} onClick={() => navigate(cliente ? "/cliente-final/home" : "/cliente-final/login")}>
          <FaArrowLeft aria-hidden="true" /> Voltar
        </button>
      )}
      {!responsavelId ? (
        <section className={styles.discovery}>
          <div className={styles.searchPanel}>
            <label className={styles.searchBox}>
              <FaSearch aria-hidden="true" />
              <span className={styles.visuallyHidden}>Buscar prestador</span>
              <input type="search" placeholder="Busque pelo nome do estabelecimento ou profissional" value={buscaPrestador}
                onChange={(event) => setBuscaPrestador(event.target.value)} />
            </label>
            <div className={styles.filterPills} role="group" aria-label="Filtrar prestadores">
              {([
                ["TODOS", "Todos"],
                ["AUTONOMO", "Autônomos"],
                ["EMPRESA", "Empresas"],
              ] as const).map(([tipo, label]) => (
                <button type="button" key={tipo} className={filtroPrestador === tipo ? styles.filterSelected : ""}
                  aria-pressed={filtroPrestador === tipo} onClick={() => setFiltroPrestador(tipo)}>{label}</button>
              ))}
            </div>
          </div>
          <div className={styles.sectionHeading}>
            <div><h2>Explore os prestadores</h2><p>Encontre o atendimento que combina com você</p></div>
            {!loadingResponsaveis && <span>{prestadoresFiltrados.length} {prestadoresFiltrados.length === 1 ? "resultado" : "resultados"}</span>}
          </div>
          {loadingResponsaveis ? <LoadingState label={t("client.providersLoading")} variant="client-providers" compact /> :
            responsaveis.length === 0 ? <p className={styles.emptyState}>{t("client.providersEmpty")}</p> :
            prestadoresFiltrados.length === 0 ? <p className={styles.emptyState}>Nenhum prestador corresponde à sua busca.</p> :
            <div className={styles.providerList}>
              {prestadoresFiltrados.map((responsavel) => (
                <button type="button" key={responsavel.Id} className={styles.providerCard}
                  onClick={() => handleResponsavelChange(responsavel.Id)}>
                  <ProfilePhoto source={responsavel.FotoPerfil} name={responsavel.Nome} />
                  <span className={styles.providerDetails}>
                    <strong>{formatPersonName(responsavel.Nome)}</strong>
                    <small>{responsavel.TipoUsuario === "EMPRESA" ? <><FaBuilding /> Empresa</> : <><FaUser /> Autônomo</>}</small>
                    <span className={styles.providerHint}>Conhecer serviços e horários</span>
                  </span>
                  <FaArrowRight className={styles.providerArrow} aria-hidden="true" />
                </button>
              ))}
            </div>}
        </section>
      ) : (
        <section className={styles.bookingPage}>
          <button type="button" className={styles.backToProviders} onClick={() => {
            if (etapaAtual === "confirmacao") {
              setExpandedSection("horario");
            } else if (etapaAtual === "horario") {
              setExpandedSection("servico");
            } else if (etapaAtual === "servico" && responsavelEhEmpresa) {
              setExpandedSection("profissional");
            } else if (username) {
              // Ao sair de uma pagina acessada por slug, volte a listagem existente.
              try {
                sessionStorage.removeItem(storageKey);
                sessionStorage.removeItem(`nexoelo-booking-draft:${cliente?.Id ?? "guest"}:marketplace`);
              } catch { /* Armazenamento opcional. */ }
              // Esta pagina e reutilizada entre as rotas com e sem slug.
              // Limpe o estado em memoria ANTES de trocar a URL para que a
              // tela de descoberta apareca no primeiro clique.
              handleResponsavelChange(0);
              setExpandedSection("responsavel");
              navigate("/cliente-final/agendar", { replace: true });
            } else {
              handleResponsavelChange(0);
            }
          }}>
            <FaArrowLeft aria-hidden="true" /> Voltar
          </button>
          <div className={styles.providerHero}>
            <div className={styles.heroBackdrop} aria-hidden="true" />
            <div className={styles.heroContent}>
              <ProfilePhoto source={selectedResponsavel?.FotoPerfil} name={selectedResponsavel?.Nome ?? "Prestador"} />
              <div>
                <h2>{formatPersonName(selectedResponsavel?.Nome ?? "")}</h2>
                <span className={styles.heroBadge}>{responsavelEhEmpresa ? <><FaBuilding /> Empresa</> : <><FaUser /> Profissional autônomo</>}</span>
              </div>
            </div>
          </div>

          <nav className={styles.bookingProgress} aria-label="Etapas do agendamento">
            <span className={etapaAtual === "profissional" || etapaAtual === "servico" ? styles.progressCurrent : ""}>1. {responsavelEhEmpresa ? "Profissional" : "Serviço"}</span>
            <span className={etapaAtual === "horario" ? styles.progressCurrent : ""}>2. {responsavelEhEmpresa ? "Serviço e horário" : "Data e horário"}</span>
            <span className={etapaAtual === "confirmacao" ? styles.progressCurrent : ""}>3. Confirmar</span>
          </nav>

          <form className={styles.bookingForm} onSubmit={handleSubmit}>
            {responsavelEhEmpresa && etapaAtual === "profissional" && (
              <section className={styles.bookingPanel}>
                <div className={styles.sectionHeading}><div><h2>Com quem deseja agendar?</h2><p>Selecione o profissional que vai atender você.</p></div></div>
                {loadingProfissionais ? <LoadingState label={t("client.professionalsLoading")} variant="client-professionals" compact /> :
                  profissionais.length === 0 ? <p className={styles.emptyState}>{t("client.professionalsEmpty")}</p> :
                  <div className={styles.providerList}>
                    {profissionais.map((profissional) => (
                      <button type="button" key={profissional.Id} className={styles.providerCard} onClick={() => handleProfissionalChange(profissional.Id)}>
                        <ProfilePhoto source={profissional.FotoPerfil} name={profissional.Nome} />
                        <span className={styles.providerDetails}><strong>{formatPersonName(profissional.Nome)}</strong><small>Profissional</small></span>
                        <FaArrowRight aria-hidden="true" className={styles.providerArrow} />
                      </button>
                    ))}
                  </div>}
              </section>
            )}

            {etapaAtual === "servico" && (
              <section className={styles.bookingPanel}>
                <div className={styles.sectionHeading}>
                  <div><h2>Serviços disponíveis</h2><p>Selecione os serviços desejados. Você também pode escolher outro profissional da empresa.</p></div>
                  {responsavelEhEmpresa && <button type="button" className={styles.textAction} onClick={() => setExpandedSection("profissional")}>Escolher outro profissional</button>}
                </div>
                {responsavelEhEmpresa && selectedProfissional && <p className={styles.selectedProfessional}>Com {formatPersonName(selectedProfissional.Nome)}</p>}
                {loadingServicos ? <LoadingState label={t("client.servicesLoading")} variant="client-services" compact /> :
                  servicos.length === 0 ? <p className={styles.emptyState}>{t("client.servicesEmpty")}</p> :
                  <div className={styles.serviceList}>
                    {servicos.map((servico) => (
                      <button type="button" key={servico.Id} className={`${styles.catalogService} ${servicoIds.includes(servico.Id) ? styles.catalogServiceSelected : ""}`} aria-pressed={servicoIds.includes(servico.Id)} onClick={() => handleServicoChange(servico.Id)}>
                        <ServicePhoto source={servico.ImagemServico} name={servico.NomeServico} />
                        <span className={styles.serviceDetails}>
                          <strong>{servico.NomeServico}</strong>
                          <small><FaClock aria-hidden="true" /> {servico.TempoEstimadoMinutos} min</small>
                          <b>{formatCurrency(servico.Valor)}</b>
                        </span>
                        <span className={styles.serviceAction}>{servicoIds.includes(servico.Id) ? <><FaCheck aria-hidden="true" /> Selecionado</> : "Adicionar"}</span>
                      </button>
                    ))}
                  </div>}
                {responsavelEhEmpresa && selecoes.length > 0 && (
                  <div className={styles.multipleProfessionalSummary}>
                    <strong>Serviços selecionados</strong>
                    {selecoes.map(item => (
                      <div key={item.servico.Id} className={styles.selectedAssignment}>
                        <span>{item.servico.NomeServico} — {formatPersonName(profissionais.find(pro => pro.Id === item.profissionalId)?.Nome ?? "Profissional")}</span>
                        <button type="button" aria-label={`Remover ${item.servico.NomeServico}`} onClick={() => {
                          const proximas = selecoes.filter(selected => selected.servico.Id !== item.servico.Id);
                          setSelecoes(proximas);
                          setServicoIds(proximas.map(selected => selected.servico.Id));
                          resetSchedule();
                        }}>Remover</button>
                      </div>
                    ))}
                    <button type="button" className={styles.otherProfessionalButton} onClick={() => setExpandedSection("profissional")}>
                      <FaUser aria-hidden="true" /> Adicionar serviços de outro profissional
                    </button>
                  </div>
                )}
                {servicoIds.length > 0 && (
                  <div className={styles.servicesSelectionFooter}>
                    <div><strong>{servicoIds.length} {servicoIds.length === 1 ? "serviço" : "serviços"}</strong><span>{totalDuracao} min · {formatCurrency(totalValor)}</span></div>
                    <button type="button" onClick={advanceToSchedule}>Escolher horário <FaArrowRight aria-hidden="true" /></button>
                  </div>
                )}
              </section>
            )}

            {etapaAtual === "horario" && (
              <section className={styles.bookingPanel}>
                <div className={styles.sectionHeading}><div><h2>Escolha a data e o horário</h2><p>Horários atualizados conforme a disponibilidade do prestador.</p></div></div>
                <div className={styles.selectionSummary}>
                  <span><strong>{selectedServicos.map(item => item.NomeServico).join(" + ")}</strong> · {totalDuracao} min · {formatCurrency(totalValor)} {multiplosProfissionais ? "· Vários profissionais" : ""}</span>
                  <button type="button" className={styles.textAction} onClick={() => setExpandedSection("servico")}>Alterar serviços</button>
                </div>
                <div className={styles.scheduleLayout}>
                  <label className={styles.dateField} htmlFor="booking-date">
                    <span><FaCalendarAlt aria-hidden="true" /> {t("client.date")}</span>
                    <input id="booking-date" type="date" min={minDate} value={dataSelecionada}
                      style={{ colorScheme: themeName === "dark" ? "dark" : "light" }}
                      onChange={(event) => handleDataChange(event.target.value)} />
                  </label>
                  <div className={styles.scheduleRegion}>
                    {!dataSelecionada ? <p className={styles.emptyState}>Escolha uma data para consultar os horários disponíveis.</p> :
                      <fieldset className={styles.scheduleFieldset} disabled={loadingHorarios}>
                        <legend>{t("client.availableSlots")}</legend>
                        {loadingHorarios ? <LoadingState label={t("client.slotsLoading")} variant="client-slots" compact /> :
                          horariosDisponiveis.length === 0 ? <p className={styles.scheduleFeedback}>{t("client.slotsEmpty")}</p> :
                          <div className={styles.timeGrid}>
                            {horariosDisponiveis.map((horario) => (
                              <button key={horario.DataAgendamento} type="button" className={dataAgendamento === horario.DataAgendamento ? styles.timeButtonSelected : styles.timeButton}
                                aria-pressed={dataAgendamento === horario.DataAgendamento} onClick={() => {
                                  setDataAgendamento(horario.DataAgendamento);
                                  setExpandedSection("confirmacao");
                                  setError("");
                                  setSuccess("");
                                }}>{horario.Horario}</button>
                            ))}
                          </div>}
                      </fieldset>}
                  </div>
                </div>
              </section>
            )}

            {etapaAtual === "confirmacao" && (
              <section className={styles.bookingPanel}>
                {success ? (
                  <div className={styles.successPanel}><FaCheck aria-hidden="true" /><h2>Agendamento realizado!</h2><p>{success}</p>
                    <Link to="/cliente-final/home">Ver meus agendamentos</Link></div>
                ) : (
                  <>
                    <div className={styles.sectionHeading}><div><h2>Revise seu agendamento</h2><p>Confira as informações antes de confirmar.</p></div></div>
                    <div className={styles.reviewList}>
                      <div><span>Prestador</span><strong>{formatPersonName(selectedResponsavel?.Nome ?? "")}</strong></div>
                      {responsavelEhEmpresa && <div><span>Profissional</span><strong>{multiplosProfissionais ? "Vários profissionais" : formatPersonName(selectedProfissional?.Nome ?? "")}</strong></div>}
                      <div><span>Serviços</span><strong>{selectedServicos.map(item => item.NomeServico).join(" + ")}</strong></div>
                      {responsavelEhEmpresa && selecoes.length > 0 && <div><span>Atendimentos</span><strong>{selecoes.map(item => `${item.servico.NomeServico} — ${formatPersonName(profissionais.find(pro => pro.Id === item.profissionalId)?.Nome ?? "Profissional")}`).join(" · ")}</strong></div>}
                      <div><span>Duração total</span><strong>{totalDuracao} min</strong></div>
                      <div><span>Data e horário</span><strong>{dataFormatada} · {selectedHorario?.Horario}</strong></div>
                      <div className={styles.reviewTotal}><span>Valor dos serviços</span><strong>{formatCurrency(totalValor)}</strong></div>
                      {metodoPagamento === "ONLINE" && totalOnline && (
                        <>
                          <div><span>Custo do pagamento online (cliente)</span><strong>{formatCurrency(totalOnline.tarifa)}</strong></div>
                          <div className={styles.reviewTotal}><span>Total a pagar com cartão</span><strong>{formatCurrency(totalOnline.total)}</strong></div>
                          <small>O estabelecimento recebe o valor integral dos serviços. O custo do processamento é acrescentado ao pagamento online.</small>
                        </>
                      )}
                    </div>
                    <fieldset className={styles.paymentChoice}>
                      <legend>Como deseja pagar?</legend>
                      {loadingPagamento && <p>Carregando formas de pagamento...</p>}
                      {!loadingPagamento && !configPagamento && <p>As opções de pagamento não estão disponíveis no momento.</p>}
                      {configPagamento && configPagamento.Modalidade !== "ONLINE" && (
                        <label><input type="radio" name="pagamento" checked={metodoPagamento === "PRESENCIAL"}
                          onChange={() => setMetodoPagamento("PRESENCIAL")} />
                          <span><strong>Pagar no estabelecimento</strong><small>Pagamento diretamente ao prestador após o atendimento.</small></span>
                        </label>
                      )}
                      {configPagamento && configPagamento.Modalidade !== "PRESENCIAL" && (
                        <label><input type="radio" name="pagamento" checked={metodoPagamento === "ONLINE"}
                          disabled={!configPagamento.OnlineDisponivel}
                          onChange={() => setMetodoPagamento("ONLINE")} />
                          <span><strong>Pagar agora pela Stripe</strong>
                            <small>{configPagamento.OnlineDisponivel ? "Pagamento com cartão. O custo de processamento é acrescentado ao valor dos serviços." :
                              "O estabelecimento ainda não habilitou sua conta recebedora."}</small></span>
                        </label>
                      )}
                    </fieldset>
                    <button type="button" className={styles.textAction} onClick={() => setExpandedSection("horario")}>Alterar data ou horário</button>
                  </>
                )}
              </section>
            )}

            {error && <p role="alert" className={styles.error}>{error}</p>}
            {success && etapaAtual !== "confirmacao" && <p className={styles.success}>{success}</p>}

            {(etapaAtual === "horario" || etapaAtual === "confirmacao") && !success && (
              <div className={styles.bookingFooter}>
                {etapaAtual === "confirmacao" && <button type="submit" className={styles.footerConfirm}
                  disabled={loading || loadingHorarios || loadingPagamento || !configPagamento || !dataAgendamento || !selectedHorario || (metodoPagamento === "ONLINE" && !configPagamento.OnlineDisponivel)}>
                  {loading ? "Agendando..." : cliente ? "Confirmar agendamento" : "Entrar para agendar"}
                </button>}
                {etapaAtual === "horario" && <span className={styles.footerHint}>Selecione um horário para continuar</span>}
              </div>
            )}
          </form>
        </section>
      )}
    </main>
  );
}
