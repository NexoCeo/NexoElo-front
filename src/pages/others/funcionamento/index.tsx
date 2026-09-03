import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaCheck,
  FaClock,
  FaCoffee,
  FaPlus,
  FaSave,
  FaTrash,
} from "react-icons/fa";
import { useTheme } from "@/context/ThemeContext";
import { useUser } from "@/context/UserContext";
import { useNotification } from "@/context/NotificationContext";
import {
  criarFuncionamentoPadrao,
  obterFuncionamento,
  salvarFuncionamento,
} from "@/services/funcionamento-service";
import type { DiaFuncionamentoKey, FuncionamentoConfig } from "@/types/funcionamento";
import styles from "./style.module.css";

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

function getApiErrorMessage(data?: ApiError) {
  if (!data) return "Nao foi possivel salvar o funcionamento.";
  if (typeof data === "string") return data;

  if (data.errors) {
    const messages = Object.entries(data.errors)
      .flatMap(([field, errors]) => errors.map((error) => `${field}: ${error}`))
      .join(" ");

    if (messages) return messages;
  }

  return data.erro || data.message || data.title || "Nao foi possivel salvar o funcionamento.";
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

export default function Funcionamento() {
  const { theme } = useTheme();
  const { usuario } = useUser();
  const { showNotification } = useNotification();
  const [config, setConfig] = useState<FuncionamentoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const usuarioId = usuario?.Id ?? 0;
  const diasSelecionados = useMemo(
    () => (config ? DIAS.filter((dia) => config[dia.key]) : []),
    [config],
  );
  const pausaTotal = config ? getPausaTotal(config) : 0;
  const expedienteTotal = config
    ? timeToMinutes(config.HorarioFechamento) - timeToMinutes(config.HorarioAbertura)
    : 0;
  const atendimentoTotal = Math.max(0, expedienteTotal - pausaTotal);

  useEffect(() => {
    async function loadFuncionamento() {
      if (!usuarioId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const data = await obterFuncionamento(usuarioId);
        setConfig(data);
      } catch {
        const message = "Nao foi possivel carregar a configuracao de funcionamento.";
        setError(message);
        showNotification({ type: "error", title: "Funcionamento indisponivel", message });
        setConfig(criarFuncionamentoPadrao(usuarioId));
      } finally {
        setLoading(false);
      }
    }

    loadFuncionamento();
  }, [showNotification, usuarioId]);

  function updateConfig(nextConfig: Partial<FuncionamentoConfig>) {
    setError("");
    setSuccess("");
    setConfig((currentConfig) => currentConfig ? { ...currentConfig, ...nextConfig } : currentConfig);
  }

  function toggleDia(dia: DiaFuncionamentoKey) {
    if (!config) return;
    updateConfig({ [dia]: !config[dia] });
  }

  function setDiasSelecionados(dias: Set<DiaFuncionamentoKey>) {
    if (!config) return;

    updateConfig(
      DIAS.reduce((result, dia) => {
        result[dia.key] = dias.has(dia.key);
        return result;
      }, {} as Record<DiaFuncionamentoKey, boolean>),
    );
  }

  function addIntervalo() {
    if (!config) return;
    const novoIntervalo = getNovoIntervalo(config);

    if (!novoIntervalo) {
      const message = "O expediente precisa ter mais de 30 minutos para receber uma pausa.";
      setError(message);
      showNotification({ type: "warning", title: "Pausa nao adicionada", message });
      return;
    }

    updateConfig({ Intervalos: [...config.Intervalos, novoIntervalo] });
  }

  function updateIntervalo(index: number, field: "Inicio" | "Fim", value: string) {
    if (!config) return;
    updateConfig({
      Intervalos: config.Intervalos.map((intervalo, currentIndex) =>
        currentIndex === index ? { ...intervalo, [field]: value } : intervalo,
      ),
    });
  }

  function removeIntervalo(index: number) {
    if (!config) return;
    updateConfig({
      Intervalos: config.Intervalos.filter((_, currentIndex) => currentIndex !== index),
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!config || !usuarioId) {
      const message = "Usuario nao encontrado para salvar funcionamento.";
      setError(message);
      showNotification({ type: "error", title: "Nao foi possivel salvar", message });
      return;
    }

    if (diasSelecionados.length === 0) {
      const message = "Selecione pelo menos um dia de atendimento.";
      setError(message);
      showNotification({ type: "warning", title: "Dias nao selecionados", message });
      return;
    }

    if (!config.HorarioAbertura || !config.HorarioFechamento) {
      const message = "Informe os horarios de abertura e fechamento.";
      setError(message);
      showNotification({ type: "warning", title: "Horario incompleto", message });
      return;
    }

    if (timeToMinutes(config.HorarioAbertura) >= timeToMinutes(config.HorarioFechamento)) {
      const message = "O horario de abertura deve ser anterior ao fechamento.";
      setError(message);
      showNotification({ type: "warning", title: "Horario invalido", message });
      return;
    }

    if (hasIntervaloInvalido(config)) {
      const message = "Todas as pausas devem ficar dentro do horario de funcionamento.";
      setError(message);
      showNotification({ type: "warning", title: "Pausa invalida", message });
      return;
    }

    if (hasIntervaloSobreposto(config)) {
      const message = "As pausas nao podem se sobrepor.";
      setError(message);
      showNotification({ type: "warning", title: "Pausas sobrepostas", message });
      return;
    }

    if (pausaTotal >= expedienteTotal) {
      const message = "As pausas precisam deixar algum horario disponivel para atendimento.";
      setError(message);
      showNotification({ type: "warning", title: "Agenda sem disponibilidade", message });
      return;
    }

    try {
      setSaving(true);
      const savedConfig = await salvarFuncionamento(usuarioId, config);
      setConfig(savedConfig);
      setSuccess("Funcionamento salvo com sucesso.");
      showNotification({
        type: "success",
        title: "Funcionamento salvo",
        message: "Os novos dias e horarios ja valem para os agendamentos.",
      });
    } catch (err) {
      const message = isAxiosError<ApiError>(err)
        ? getApiErrorMessage(err.response?.data)
        : "Nao foi possivel salvar o funcionamento.";
      setError(message);
      showNotification({ type: "error", title: "Funcionamento nao salvo", message });
    } finally {
      setSaving(false);
    }
  }

  const cardStyle = {
    backgroundColor: theme.colors.background2,
    borderColor: theme.colors.bottom,
  };

  return (
    <main className={styles.container} style={{ backgroundColor: theme.colors.background }}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow} style={{ color: theme.colors.primary }}>Agenda semanal</span>
          <h1 style={{ color: theme.colors.text }}>Funcionamento</h1>
          <p style={{ color: theme.colors.inactive }}>Defina quando sua agenda pode receber atendimentos.</p>
        </div>
      </header>

      <div className={styles.content}>
        <form className={styles.editor} onSubmit={handleSubmit} noValidate>
          {loading || !config ? (
            <section className={styles.card} style={cardStyle}>
              <p className={styles.feedback} style={{ color: theme.colors.text }}>
                Carregando funcionamento...
              </p>
            </section>
          ) : (
            <>
              <section className={styles.card} style={cardStyle}>
                <div className={styles.cardHeader}>
                  <div className={styles.titleGroup}>
                    <span className={styles.step} style={{ backgroundColor: theme.colors.primary }}>1</span>
                    <div>
                      <h2 style={{ color: theme.colors.text }}>Dias de atendimento</h2>
                      <p style={{ color: theme.colors.inactive }}>{diasSelecionados.length} de 7 selecionados</p>
                    </div>
                  </div>
                  <div className={styles.presets} aria-label="Selecao rapida de dias">
                    <button type="button" onClick={() => setDiasSelecionados(DIAS_UTEIS)}>Seg a sex</button>
                    <button type="button" onClick={() => setDiasSelecionados(new Set(DIAS.map((dia) => dia.key)))}>Todos</button>
                    <button type="button" onClick={() => setDiasSelecionados(new Set())}>Limpar</button>
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
                        aria-label={`${dia.label}: ${active ? "selecionado" : "nao selecionado"}`}
                        style={{
                          borderColor: active ? theme.colors.primary : theme.colors.bottom,
                          color: active ? theme.colors.text : theme.colors.inactive,
                          backgroundColor: active ? theme.colors.primary : "transparent",
                        }}
                      >
                        <span className={styles.dayCheck}>{active && <FaCheck aria-hidden="true" />}</span>
                        <strong>{dia.short}</strong>
                        <span className={styles.dayFullName}>{dia.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.card} style={cardStyle}>
                <div className={styles.cardHeader}>
                  <div className={styles.titleGroup}>
                    <span className={styles.step} style={{ backgroundColor: theme.colors.primary }}>2</span>
                    <div>
                      <h2 style={{ color: theme.colors.text }}>Horario de funcionamento</h2>
                      <p style={{ color: theme.colors.inactive }}>Expediente aplicado aos dias selecionados</p>
                    </div>
                  </div>
                  <span className={styles.duration} style={{ color: theme.colors.primary }}>
                    <FaClock aria-hidden="true" /> {formatDuration(expedienteTotal)}
                  </span>
                </div>

                <div className={styles.timeRange}>
                  <label style={{ color: theme.colors.text }}>
                    Abertura
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
                    Fechamento
                    <input
                      type="time"
                      value={config.HorarioFechamento}
                      onChange={(event) => updateConfig({ HorarioFechamento: event.target.value })}
                      step="900"
                      required
                    />
                  </label>
                </div>
              </section>

              <section className={styles.card} style={cardStyle}>
                <div className={styles.cardHeader}>
                  <div className={styles.titleGroup}>
                    <span className={styles.step} style={{ backgroundColor: theme.colors.primary }}>3</span>
                    <div>
                      <h2 style={{ color: theme.colors.text }}>Pausas e intervalos</h2>
                      <p style={{ color: theme.colors.inactive }}>Almoco, cafe ou outros periodos indisponiveis</p>
                    </div>
                  </div>
                  <button type="button" className={styles.addButton} onClick={addIntervalo}>
                    <FaPlus aria-hidden="true" /> Adicionar pausa
                  </button>
                </div>

                {config.Intervalos.length === 0 ? (
                  <div className={styles.emptyState} style={{ borderColor: theme.colors.bottom }}>
                    <FaCoffee aria-hidden="true" />
                    <div>
                      <strong style={{ color: theme.colors.text }}>Sem pausas</strong>
                      <span style={{ color: theme.colors.inactive }}>Atendimento continuo durante o expediente.</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.intervalList}>
                    {config.Intervalos.map((intervalo, index) => (
                      <div key={index} className={styles.intervalRow} style={{ borderColor: theme.colors.bottom }}>
                        <div className={styles.intervalName}>
                          <FaCoffee aria-hidden="true" />
                          <span style={{ color: theme.colors.text }}>Pausa {index + 1}</span>
                        </div>
                        <label style={{ color: theme.colors.inactive }}>
                          Inicio
                          <input
                            aria-label={`Inicio da pausa ${index + 1}`}
                            type="time"
                            value={intervalo.Inicio}
                            min={config.HorarioAbertura}
                            max={config.HorarioFechamento}
                            step="900"
                            onChange={(event) => updateIntervalo(index, "Inicio", event.target.value)}
                          />
                        </label>
                        <label style={{ color: theme.colors.inactive }}>
                          Fim
                          <input
                            aria-label={`Fim da pausa ${index + 1}`}
                            type="time"
                            value={intervalo.Fim}
                            min={config.HorarioAbertura}
                            max={config.HorarioFechamento}
                            step="900"
                            onChange={(event) => updateIntervalo(index, "Fim", event.target.value)}
                          />
                        </label>
                        <span className={styles.intervalDuration} style={{ color: theme.colors.inactive }}>
                          {formatDuration(timeToMinutes(intervalo.Fim) - timeToMinutes(intervalo.Inicio))}
                        </span>
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => removeIntervalo(index)}
                          aria-label={`Remover pausa ${index + 1}`}
                          title="Remover pausa"
                        >
                          <FaTrash aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className={styles.actions}>
                <div className={styles.messages} aria-live="polite">
                  {error && <p className={styles.error} role="alert">{error}</p>}
                  {success && <p className={styles.success}>{success}</p>}
                </div>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={saving}
                  style={{ backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }}
                >
                  <FaSave aria-hidden="true" />
                  {saving ? "Salvando..." : "Salvar funcionamento"}
                </button>
              </div>
            </>
          )}
        </form>

        <aside className={styles.summary} style={cardStyle}>
          <div className={styles.summaryTitle}>
            <FaCalendarAlt aria-hidden="true" style={{ color: theme.colors.primary }} />
            <h2 style={{ color: theme.colors.text }}>Resumo semanal</h2>
          </div>

          <div className={styles.summaryBlock}>
            <span style={{ color: theme.colors.inactive }}>Dias de atendimento</span>
            <strong style={{ color: theme.colors.text }}>
              {diasSelecionados.length > 0
                ? diasSelecionados.map((dia) => dia.short).join(", ")
                : "Nenhum dia"}
            </strong>
          </div>

          <div className={styles.summaryBlock}>
            <span style={{ color: theme.colors.inactive }}>Expediente</span>
            <strong className={styles.summaryHours} style={{ color: theme.colors.primary }}>
              {config ? `${config.HorarioAbertura} - ${config.HorarioFechamento}` : "--:-- - --:--"}
            </strong>
            <small style={{ color: theme.colors.inactive }}>
              {formatDuration(atendimentoTotal)} disponiveis por dia
            </small>
          </div>

          <div className={styles.summaryBlock}>
            <span style={{ color: theme.colors.inactive }}>
              {config?.Intervalos.length ?? 0} pausa{config?.Intervalos.length === 1 ? "" : "s"}
            </span>
            {config?.Intervalos.length ? (
              <div className={styles.summaryIntervals}>
                {config.Intervalos.map((intervalo, index) => (
                  <small key={index} style={{ color: theme.colors.text }}>
                    Pausa {index + 1}<span style={{ color: theme.colors.inactive }}>{intervalo.Inicio} - {intervalo.Fim}</span>
                  </small>
                ))}
              </div>
            ) : (
              <small style={{ color: theme.colors.inactive }}>Atendimento sem interrupcoes</small>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
