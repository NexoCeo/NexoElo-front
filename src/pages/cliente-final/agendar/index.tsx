import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FaBuilding,
  FaCalendarAlt,
  FaCheck,
  FaChevronDown,
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
import { useNotification } from "@/context/NotificationContext";

type ApiError = string | {
  erro?: string;
  message?: string;
  title?: string;
};

type BookingSection = "responsavel" | "profissional" | "servico" | "horario";

type StepLegendProps = {
  number: number;
  title: string;
  summary?: string;
  expanded: boolean;
  disabled?: boolean;
  controls: string;
  onToggle: () => void;
};

function StepLegend({
  number,
  title,
  summary,
  expanded,
  disabled = false,
  controls,
  onToggle,
}: StepLegendProps) {
  return (
    <legend>
      <button
        type="button"
        className={styles.stepToggle}
        aria-expanded={expanded}
        aria-controls={controls}
        aria-label={`${expanded ? "Recolher" : "Expandir"} ${title}`}
        disabled={disabled}
        onClick={onToggle}
      >
        <span className={styles.stepTitle}>
          <span className={styles.stepNumber}>{number}</span>
          {title}
        </span>
        {summary && <span className={styles.stepSummary}>{summary}</span>}
        <FaChevronDown
          className={`${styles.stepChevron} ${expanded ? styles.stepChevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>
    </legend>
  );
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
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const cliente = getClienteFinalUser();
  const [responsaveis, setResponsaveis] = useState<ResponsavelAgendamento[]>([]);
  const [profissionais, setProfissionais] = useState<ProfissionalAgendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<HorarioDisponivel[]>([]);
  const [responsavelId, setResponsavelId] = useState(0);
  const [profissionalId, setProfissionalId] = useState(0);
  const [servicoId, setServicoId] = useState(0);
  const [dataSelecionada, setDataSelecionada] = useState("");
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [refreshHorarios, setRefreshHorarios] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingResponsaveis, setLoadingResponsaveis] = useState(false);
  const [loadingProfissionais, setLoadingProfissionais] = useState(false);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedSection, setExpandedSection] = useState<BookingSection | null>("responsavel");

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
  const professionalStep = responsavelEhEmpresa ? 2 : 0;
  const serviceStep = responsavelEhEmpresa ? 3 : 2;
  const scheduleStep = responsavelEhEmpresa ? 4 : 3;

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
            setResponsavelId(data[0].Id);
            setExpandedSection(data[0].TipoUsuario === "EMPRESA" ? "profissional" : "servico");
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
    setProfissionalId(0);

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
    setServicoId(0);

    if (!responsavelId || (responsavelEhEmpresa && !profissionalId)) {
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
  }, [profissionalId, responsavelEhEmpresa, responsavelId, showNotification]);

  useEffect(() => {
    let active = true;

    setHorariosDisponiveis([]);
    setDataAgendamento("");

    if (
      !responsavelId ||
      !servicoId ||
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

  function toggleSection(section: BookingSection, enabled = true) {
    if (!enabled) return;
    setExpandedSection((current) => current === section ? null : section);
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
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <span>Cliente final</span>
          <h1>Novo agendamento</h1>
        </div>
        <Link to={cliente ? "/cliente-final/home" : loginUrl}>
          {cliente ? "Voltar" : "Entrar"}
        </Link>
      </header>

      <section className={styles.content}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <fieldset className={`${styles.selectionGroup} ${expandedSection !== "responsavel" ? styles.selectionGroupCollapsed : ""}`}>
            <StepLegend
              number={1}
              title="Autonomo ou empresa"
              summary={selectedResponsavel?.Nome}
              expanded={expandedSection === "responsavel"}
              controls="responsavel-options"
              onToggle={() => toggleSection("responsavel")}
            />

            {expandedSection === "responsavel" && (
              <div id="responsavel-options">
                {loadingResponsaveis ? (
                  <p className={styles.optionFeedback}>Carregando prestadores...</p>
                ) : responsaveis.length === 0 ? (
                  <p className={styles.optionFeedback}>Nenhum prestador disponivel.</p>
                ) : (
                  <div className={styles.optionGrid}>
                    {responsaveis.map((responsavel) => {
                      const selected = responsavel.Id === responsavelId;

                      return (
                        <button
                          key={responsavel.Id}
                          type="button"
                          className={`${styles.identityOption} ${selected ? styles.optionSelected : ""}`}
                          aria-pressed={selected}
                          onClick={() => handleResponsavelChange(responsavel.Id)}
                        >
                          <ProfilePhoto source={responsavel.FotoPerfil} name={responsavel.Nome} />
                          <span className={styles.optionText}>
                            <strong>{responsavel.Nome}</strong>
                            <small>
                              {responsavel.TipoUsuario === "EMPRESA" ? (
                                <><FaBuilding aria-hidden="true" /> Empresa</>
                              ) : (
                                <><FaUser aria-hidden="true" /> Autonomo</>
                              )}
                            </small>
                          </span>
                          {selected && <FaCheck className={styles.selectedIcon} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {responsavelEhEmpresa && (
            <fieldset className={`${styles.selectionGroup} ${expandedSection !== "profissional" ? styles.selectionGroupCollapsed : ""}`}>
              <StepLegend
                number={professionalStep}
                title="Profissional"
                summary={selectedProfissional?.Nome}
                expanded={expandedSection === "profissional"}
                controls="profissional-options"
                onToggle={() => toggleSection("profissional")}
              />

              {expandedSection === "profissional" && (
                <div id="profissional-options">
                  {loadingProfissionais ? (
                    <p className={styles.optionFeedback}>Carregando profissionais...</p>
                  ) : profissionais.length === 0 ? (
                    <p className={styles.optionFeedback}>Nenhum profissional disponivel.</p>
                  ) : (
                    <div className={styles.optionGrid}>
                      {profissionais.map((profissional) => {
                        const selected = profissional.Id === profissionalId;

                        return (
                          <button
                            key={profissional.Id}
                            type="button"
                            className={`${styles.identityOption} ${selected ? styles.optionSelected : ""}`}
                            aria-pressed={selected}
                            onClick={() => handleProfissionalChange(profissional.Id)}
                          >
                            <ProfilePhoto source={profissional.FotoPerfil} name={profissional.Nome} />
                            <span className={styles.optionText}>
                              <strong>{profissional.Nome}</strong>
                              <small><FaUser aria-hidden="true" /> Profissional</small>
                            </span>
                            {selected && <FaCheck className={styles.selectedIcon} aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}

          <fieldset
            className={`${styles.selectionGroup} ${expandedSection !== "servico" ? styles.selectionGroupCollapsed : ""}`}
            disabled={!responsavelId || (responsavelEhEmpresa && !profissionalId)}
          >
            <StepLegend
              number={serviceStep}
              title="Servico"
              summary={selectedServico?.NomeServico}
              expanded={expandedSection === "servico"}
              disabled={!responsavelId || (responsavelEhEmpresa && !profissionalId)}
              controls="servico-options"
              onToggle={() => toggleSection(
                "servico",
                Boolean(responsavelId && (!responsavelEhEmpresa || profissionalId)),
              )}
            />

            {expandedSection === "servico" && (
              <div id="servico-options">
                {loadingServicos ? (
                  <p className={styles.optionFeedback}>Carregando servicos...</p>
                ) : !responsavelId ? (
                  <p className={styles.optionFeedback}>Selecione quem vai atender.</p>
                ) : responsavelEhEmpresa && !profissionalId ? (
                  <p className={styles.optionFeedback}>Selecione um profissional.</p>
                ) : servicos.length === 0 ? (
                  <p className={styles.optionFeedback}>Nenhum servico disponivel.</p>
                ) : (
                  <div className={`${styles.optionGrid} ${styles.serviceGrid}`}>
                    {servicos.map((servico) => {
                      const selected = servico.Id === servicoId;

                      return (
                        <button
                          key={servico.Id}
                          type="button"
                          className={`${styles.serviceOption} ${selected ? styles.optionSelected : ""}`}
                          aria-pressed={selected}
                          onClick={() => handleServicoChange(servico.Id)}
                        >
                          <ServicePhoto source={servico.ImagemServico} name={servico.NomeServico} />
                          <span className={styles.optionText}>
                            <strong>{servico.NomeServico}</strong>
                            <small><FaClock aria-hidden="true" /> {servico.TempoEstimadoMinutos} min</small>
                            <b>{formatCurrency(servico.Valor)}</b>
                          </span>
                          {selected && <FaCheck className={styles.selectedIcon} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <fieldset
            className={`${styles.selectionGroup} ${styles.scheduleGroup} ${expandedSection !== "horario" ? styles.selectionGroupCollapsed : ""}`}
            disabled={!servicoId}
          >
            <StepLegend
              number={scheduleStep}
              title="Data e horario"
              summary={selectedHorario?.Horario || dataSelecionada}
              expanded={expandedSection === "horario"}
              disabled={!servicoId}
              controls="horario-options"
              onToggle={() => toggleSection("horario", Boolean(servicoId))}
            />

            {expandedSection === "horario" && (
              <div id="horario-options" className={styles.scheduleLayout}>
                <label className={styles.dateField} htmlFor="booking-date">
                  <span><FaCalendarAlt aria-hidden="true" /> Data</span>
                  <input
                    id="booking-date"
                    type="date"
                    min={minDate}
                    value={dataSelecionada}
                    onChange={(event) => handleDataChange(event.target.value)}
                    disabled={!servicoId}
                  />
                </label>

                <fieldset className={styles.scheduleFieldset} disabled={!dataSelecionada || loadingHorarios}>
                  <legend>Horarios disponiveis</legend>
                  {!dataSelecionada ? (
                    <p className={styles.scheduleFeedback}>Selecione uma data para consultar.</p>
                  ) : loadingHorarios ? (
                    <p className={styles.scheduleFeedback}>Carregando horarios...</p>
                  ) : horariosDisponiveis.length === 0 ? (
                    <p className={styles.scheduleFeedback}>Nenhum horario disponivel nesta data.</p>
                  ) : (
                    <div className={styles.timeGrid}>
                      {horariosDisponiveis.map((horario) => {
                        const selected = horario.DataAgendamento === dataAgendamento;

                        return (
                          <button
                            key={horario.DataAgendamento}
                            type="button"
                            className={`${styles.timeButton} ${selected ? styles.timeButtonSelected : ""}`}
                            aria-pressed={selected}
                            onClick={() => {
                              setDataAgendamento(horario.DataAgendamento);
                              setError("");
                              setSuccess("");
                            }}
                          >
                            {horario.Horario}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              </div>
            )}
          </fieldset>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={
              loading ||
              loadingResponsaveis ||
              loadingProfissionais ||
              loadingServicos ||
              loadingHorarios ||
              !dataAgendamento
            }
          >
            {loading
              ? "Agendando..."
              : cliente
                ? "Confirmar agendamento"
                : "Entrar para agendar"}
          </button>
        </form>
      </section>
    </main>
  );
}
