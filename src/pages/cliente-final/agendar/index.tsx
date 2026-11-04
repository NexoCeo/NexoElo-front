import { formatPersonName } from "@/context/UserContext";
import LoadingState from "@/components/loading-state";
import { useTheme } from "@/context/ThemeContext";
import { useEffect, useMemo, useState } from "react";
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

type BookingDraft = {
  responsavelId: number;
  profissionalId: number;
  servicoId: number;
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
  const [servicoId, setServicoId] = useState(draft?.servicoId ?? 0);
  const [dataSelecionada, setDataSelecionada] = useState(draft?.dataSelecionada ?? "");
  const [dataAgendamento, setDataAgendamento] = useState(draft?.dataAgendamento ?? "");
  const [refreshHorarios, setRefreshHorarios] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false);
  const [loadingProfissionais, setLoadingProfissionais] = useState(false);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSection, setExpandedSection] = useState<BookingSection | null>(draft?.expandedSection ?? "responsavel");
  const [buscaPrestador, setBuscaPrestador] = useState("");
  const [filtroPrestador, setFiltroPrestador] = useState<"TODOS" | "EMPRESA" | "AUTONOMO">("TODOS");

  const selectedResponsavel = responsaveis.find(
    (responsavel) => responsavel.Id === responsavelId,
  );
  const selectedHorario = horariosDisponiveis.find(
    (horario) => horario.DataAgendamento === dataAgendamento,
  );
  const selectedProfissional = profissionais.find(
    (profissional) => profissional.Id === profissionalId,
  );
  const selectedServico = servicos.find((servico) => servico.Id === servicoId);
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
          responsavelId, profissionalId, servicoId, dataSelecionada,
          dataAgendamento, expandedSection: etapaAtual,
        } satisfies BookingDraft));
      }
    } catch {
      // O agendamento continua funcionando mesmo com armazenamento indisponivel.
    }
  }, [storageKey, responsavelId, profissionalId, servicoId, dataSelecionada, dataAgendamento, etapaAtual, success]);

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
              setServicoId(0);
              setDataSelecionada("");
              setDataAgendamento("");
              setExpandedSection(data[0].TipoUsuario === "EMPRESA" ? "profissional" : "servico");
            }
          } else if (draft?.responsavelId && !data.some(item => item.Id === draft.responsavelId)) {
            setResponsavelId(0);
            setProfissionalId(0);
            setServicoId(0);
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
            setServicoId(0);
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
          if (servicoId && !data.some(item => item.Id === servicoId)) {
            setServicoId(0);
            setDataSelecionada("");
            setDataAgendamento("");
            setExpandedSection("servico");
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
      !selectedServico ||
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
    selectedServico,
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
    setServicoId(0);
    resetSchedule();
    setError("");
    setSuccess("");
    setExpandedSection(nextResponsavel?.TipoUsuario === "EMPRESA" ? "profissional" : "servico");
  }

  function handleProfissionalChange(nextProfissionalId: number) {
    setProfissionalId(nextProfissionalId);
    setServicos([]);
    setServicoId(0);
    resetSchedule();
    setError("");
    setSuccess("");
    setExpandedSection("servico");
  }

  function handleServicoChange(nextServicoId: number) {
    setServicoId(nextServicoId);
    resetSchedule();
    setError("");
    setSuccess("");
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

    try {
      setLoading(true);
      await criarAgendamento({
        ClienteId: cliente.Id,
        ResponsavelId: responsavelId,
        ProfissionalId: responsavelEhEmpresa ? profissionalId : undefined,
        ServicoId: servicoId,
        DataAgendamento: dataAgendamento,
      });
      setSuccess("Agendamento criado com sucesso.");
      showNotification({
        type: "success",
        title: "Agendamento confirmado",
        message: "Seu novo horario ja aparece no historico.",
      });
      setDataAgendamento("");
      setRefreshHorarios((current) => current + 1);
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
          {loadingResponsaveis ? <LoadingState label={t("client.providersLoading")} compact /> :
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
                {loadingProfissionais ? <LoadingState label={t("client.professionalsLoading")} compact /> :
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
                  <div><h2>Serviços disponíveis</h2><p>Escolha o atendimento que você procura.</p></div>
                  {responsavelEhEmpresa && <button type="button" className={styles.textAction} onClick={() => setExpandedSection("profissional")}>Trocar profissional</button>}
                </div>
                {responsavelEhEmpresa && selectedProfissional && <p className={styles.selectedProfessional}>Com {formatPersonName(selectedProfissional.Nome)}</p>}
                {loadingServicos ? <LoadingState label={t("client.servicesLoading")} compact /> :
                  servicos.length === 0 ? <p className={styles.emptyState}>{t("client.servicesEmpty")}</p> :
                  <div className={styles.serviceList}>
                    {servicos.map((servico) => (
                      <button type="button" key={servico.Id} className={styles.catalogService} onClick={() => handleServicoChange(servico.Id)}>
                        <ServicePhoto source={servico.ImagemServico} name={servico.NomeServico} />
                        <span className={styles.serviceDetails}>
                          <strong>{servico.NomeServico}</strong>
                          <small><FaClock aria-hidden="true" /> {servico.TempoEstimadoMinutos} min</small>
                          <b>{formatCurrency(servico.Valor)}</b>
                        </span>
                        <span className={styles.serviceAction}>Agendar <FaArrowRight aria-hidden="true" /></span>
                      </button>
                    ))}
                  </div>}
              </section>
            )}

            {etapaAtual === "horario" && (
              <section className={styles.bookingPanel}>
                <div className={styles.sectionHeading}><div><h2>Escolha a data e o horário</h2><p>Horários atualizados conforme a disponibilidade do prestador.</p></div></div>
                <div className={styles.selectionSummary}>
                  <span><strong>{selectedServico?.NomeServico}</strong> · {selectedServico ? formatCurrency(selectedServico.Valor) : ""}</span>
                  <button type="button" className={styles.textAction} onClick={() => setExpandedSection("servico")}>Alterar serviço</button>
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
                        {loadingHorarios ? <LoadingState label={t("client.slotsLoading")} compact /> :
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
                      {responsavelEhEmpresa && <div><span>Profissional</span><strong>{formatPersonName(selectedProfissional?.Nome ?? "")}</strong></div>}
                      <div><span>Serviço</span><strong>{selectedServico?.NomeServico}</strong></div>
                      <div><span>Duração</span><strong>{selectedServico?.TempoEstimadoMinutos} min</strong></div>
                      <div><span>Data e horário</span><strong>{dataFormatada} · {selectedHorario?.Horario}</strong></div>
                      <div className={styles.reviewTotal}><span>Valor do serviço</span><strong>{selectedServico ? formatCurrency(selectedServico.Valor) : ""}</strong></div>
                    </div>
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
                  disabled={loading || loadingHorarios || !dataAgendamento || !selectedHorario}>
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
