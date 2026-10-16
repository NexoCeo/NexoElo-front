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
  FaPencilAlt,
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
import { useLanguage } from "@/context/LanguageContext";
import LoadingState from "@/components/loading-state";

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

export default function Funcionamento() {
  const { theme } = useTheme();
  const { t } = useLanguage();
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
  const horariosPorDia = config?.HorariosPorDia ?? {};

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
        const message = t("hours.loadError");
        setError(message);
        showNotification({ type: "error", title: t("hours.unavailable"), message });
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

  function personalizarDia(dia: DiaFuncionamentoKey) {
    if (!config) return;
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
  }

  function alterarHorarioDia(dia: DiaFuncionamentoKey, campo: "Inicio" | "Fim", valor: string) {
    const current = config?.HorariosPorDia?.[dia];
    if (!current) return;
    updateConfig({
      HorariosPorDia: { ...config?.HorariosPorDia, [dia]: { ...current, [campo]: valor } },
    });
  }

  function removerPausaDia(dia: DiaFuncionamentoKey, index: number) {
    const current = config?.HorariosPorDia?.[dia];
    if (!current) return;
    updateConfig({
      HorariosPorDia: { ...config?.HorariosPorDia, [dia]: { ...current,
        Intervalos: current.Intervalos.filter((_, i) => i !== index) } },
    });
  }

  function adicionarPausaDia(dia: DiaFuncionamentoKey) {
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
      setError(message);
      showNotification({ type: "warning", title: t("hours.breakNotAdded"), message });
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
      const message = t("hours.userMissing");
      setError(message);
      showNotification({ type: "error", title: t("hours.notSaved"), message });
      return;
    }

    if (diasSelecionados.length === 0) {
      const message = t("hours.daysRequired");
      setError(message);
      showNotification({ type: "warning", title: t("hours.noDays"), message });
      return;
    }

    if (!config.HorarioAbertura || !config.HorarioFechamento) {
      const message = t("hours.timeRequired");
      setError(message);
      showNotification({ type: "warning", title: t("hours.timeIncomplete"), message });
      return;
    }

    if (timeToMinutes(config.HorarioAbertura) >= timeToMinutes(config.HorarioFechamento)) {
      const message = t("hours.timeInvalidDesc");
      setError(message);
      showNotification({ type: "warning", title: t("hours.timeInvalid"), message });
      return;
    }

    if (hasIntervaloInvalido(config)) {
      const message = t("hours.breakOutside");
      setError(message);
      showNotification({ type: "warning", title: t("hours.breakInvalid"), message });
      return;
    }

    if (hasIntervaloSobreposto(config)) {
      const message = t("hours.overlap");
      setError(message);
      showNotification({ type: "warning", title: t("hours.overlapTitle"), message });
      return;
    }

    if (pausaTotal >= expedienteTotal) {
      const message = t("hours.noAvailability");
      setError(message);
      showNotification({ type: "warning", title: t("hours.noAvailabilityTitle"), message });
      return;
    }

    for (const dia of diasSelecionados) {
      const especial = config.HorariosPorDia?.[dia.key];
      if (!especial) continue;
      const abertura = timeToMinutes(especial.Inicio);
      const fechamento = timeToMinutes(especial.Fim);
      const diario = { ...config, HorarioAbertura: especial.Inicio,
        HorarioFechamento: especial.Fim, Intervalos: especial.Intervalos };
      if (!especial.Inicio || !especial.Fim || abertura >= fechamento ||
          hasIntervaloInvalido(diario) || hasIntervaloSobreposto(diario) ||
          getPausaTotal(diario) >= fechamento - abertura) {
        const message = `${t("hours.reviewDay")} ${[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(d => d.key === dia.key)]}.`;
        setError(message);
        showNotification({ type: "warning", title: t("hours.specificInvalid"), message });
        return;
      }
    }

    try {
      setSaving(true);
      const savedConfig = await salvarFuncionamento(usuarioId, config);
      setConfig(savedConfig);
      setSuccess(t("hours.saved"));
      showNotification({
        type: "success",
        title: t("hours.saved"),
        message: t("hours.savedDesc"),
      });
    } catch (err) {
      const message = isAxiosError<ApiError>(err)
        ? getApiErrorMessage(err.response?.data, t("hours.saveError"))
        : t("hours.saveError");
      setError(message);
      showNotification({ type: "error", title: t("hours.saveFailedTitle"), message });
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
      <div className={styles.intro}><strong>{t("hours.intro")}</strong><span>{t("hours.introDesc")}</span></div>
      <div className={styles.content}>
        <form className={styles.editor} onSubmit={handleSubmit} noValidate>
          {loading || !config ? (
            <section className={styles.card} style={cardStyle}>
              <LoadingState label={t("hours.loading")} />
            </section>
          ) : (
            <>
              <section className={styles.card} style={cardStyle}>
                <div className={styles.cardHeader}>
                  <div className={styles.titleGroup}>
                    <span className={styles.step} style={{ backgroundColor: theme.colors.primary }}>1</span>
                    <div>
                      <h2 style={{ color: theme.colors.text }}>{t("hours.daysTitle")}</h2>
                      <p style={{ color: theme.colors.inactive }}>{t("hours.daysDesc")}</p>
                    </div>
                  </div>
                  <div className={styles.presets} aria-label={t("hours.quickSelect")}>
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
                        <span className={styles.dayCheck}>{active && <FaCheck aria-hidden="true" />}</span>
                        <strong>{[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)].slice(0,3)}</strong>
                        <span className={styles.dayFullName}>{[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)]}</span>
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
                      <h2 style={{ color: theme.colors.text }}>{t("hours.timeTitle")}</h2>
                      <p style={{ color: theme.colors.inactive }}>{t("hours.timeDesc")}</p>
                    </div>
                  </div>
                  <span className={styles.duration} style={{ color: theme.colors.primary }}>
                    <FaClock aria-hidden="true" /> {formatDuration(expedienteTotal)}
                  </span>
                </div>

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
              </section>

              <section className={styles.card} style={cardStyle}>
                <div className={styles.cardHeader}>
                  <div className={styles.titleGroup}>
                    <FaPencilAlt className={styles.editSymbol} aria-hidden="true" />
                    <div>
                      <h2 style={{ color: theme.colors.text }}>{t("hours.customTitle")}</h2>
                      <p style={{ color: theme.colors.inactive }}>{t("hours.customDesc")}</p>
                    </div>
                  </div>
                </div>
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
              </section>

              <section className={styles.card} style={cardStyle}>
                <div className={styles.cardHeader}>
                  <div className={styles.titleGroup}>
                    <span className={styles.step} style={{ backgroundColor: theme.colors.primary }}>3</span>
                    <div>
                      <h2 style={{ color: theme.colors.text }}>{t("hours.breaksTitle")}</h2>
                      <p style={{ color: theme.colors.inactive }}>{t("hours.breaksDesc")}</p>
                    </div>
                  </div>
                  <button type="button" className={styles.addButton} onClick={addIntervalo}>
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
                      <div key={index} className={styles.intervalRow} style={{ borderColor: theme.colors.bottom }}>
                        <div className={styles.intervalName}>
                          <FaCoffee aria-hidden="true" />
                          <span style={{ color: theme.colors.text }}>{t("hours.break")} {index + 1}</span>
                        </div>
                        <label style={{ color: theme.colors.inactive }}>
                          {t("hours.start")}
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
                          {t("hours.finish")}
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
                  {saving ? t("profile.saving") : t("hours.save")}
                </button>
              </div>
            </>
          )}
        </form>

        <aside className={styles.summary} style={cardStyle}>
          <div className={styles.summaryTitle}>
            <FaCalendarAlt aria-hidden="true" style={{ color: theme.colors.primary }} />
            <h2 style={{ color: theme.colors.text }}>{t("hours.summary")}</h2>
          </div>

          <div className={styles.summaryBlock}>
            <span style={{ color: theme.colors.inactive }}>{t("hours.summaryDays")}</span>
            <strong style={{ color: theme.colors.text }}>
              {diasSelecionados.length > 0
                ? diasSelecionados.map(dia => [t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item => item.key===dia.key)].slice(0,3)).join(", ")
                : "Nenhum dia"}
            </strong>
          </div>

          <div className={styles.summaryBlock}>
            <span style={{ color: theme.colors.inactive }}>{t("hours.summaryHours")}</span>
            <div className={styles.summaryIntervals}>
              {diasSelecionados.map(dia => {
                const horario = horariosPorDia[dia.key];
                const inicio = horario?.Inicio ?? config?.HorarioAbertura ?? "--:--";
                const fim = horario?.Fim ?? config?.HorarioFechamento ?? "--:--";
                return <small key={dia.key} style={{ color: theme.colors.text }}>
                  {[t("hours.day0"),t("hours.day1"),t("hours.day2"),t("hours.day3"),t("hours.day4"),t("hours.day5"),t("hours.day6")][DIAS.findIndex(item=>item.key===dia.key)].slice(0,3)}<span style={{ color: theme.colors.inactive }}>{inicio} – {fim}</span>
                </small>;
              })}
              {!diasSelecionados.length && <small>Escolha os dias de atendimento.</small>}
            </div>
          </div>

          <div className={styles.summaryBlock}>
            <span style={{ color: theme.colors.inactive }}>{t("hours.summaryBreaks")}</span>
            {config?.Intervalos.length ? (
              <div className={styles.summaryIntervals}>
                {config.Intervalos.map((intervalo, index) => (
                  <small key={index} style={{ color: theme.colors.text }}>
                    {t("hours.break")} {index + 1}<span style={{ color: theme.colors.inactive }}>{intervalo.Inicio} - {intervalo.Fim}</span>
                  </small>
                ))}
              </div>
            ) : (
              <small style={{ color: theme.colors.inactive }}>{t("hours.continuous")}</small>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
