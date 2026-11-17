import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaCalendarAlt, FaCut, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import logoNexoCeo from "@/assets/logoNexoCeo.png";
import { formatPersonName } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotification } from "@/context/NotificationContext";
import { listarHistoricoAgendamentos } from "@/services/agendamento-service";
import { getClienteFinalUser } from "@/services/cliente-final-auth-token";
import type { Agendamento } from "@/types/agendamento";
import styles from "./style.module.css";

type ClientPreferences = {
  favoriteProfessional: string;
  favoriteService: string;
};

const EMPTY_PREFERENCES: ClientPreferences = {
  favoriteProfessional: "",
  favoriteService: "",
};

function getPreferenceKey(userId: number) {
  return `nexoelo-client-preferences:${userId}`;
}

function readPreferences(userId?: number) {
  if (!userId) return { ...EMPTY_PREFERENCES };
  try {
    const raw = localStorage.getItem(getPreferenceKey(userId));
    if (!raw) return { ...EMPTY_PREFERENCES };
    const saved = JSON.parse(raw) as Partial<ClientPreferences>;
    return {
      favoriteProfessional: typeof saved.favoriteProfessional === "string" ? saved.favoriteProfessional : "",
      favoriteService: typeof saved.favoriteService === "string" ? saved.favoriteService : "",
    };
  } catch {
    return { ...EMPTY_PREFERENCES };
  }
}

export default function ClienteFinalPreferencias() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { showNotification } = useNotification();
  const cliente = getClienteFinalUser();
  const [preferences, setPreferences] = useState<ClientPreferences>(() => readPreferences(cliente?.Id));
  const [appointments, setAppointments] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!cliente?.Id) {
      setLoading(false);
      return;
    }
    void listarHistoricoAgendamentos(cliente.Id)
      .then((items) => {
        if (mounted) {
          setAppointments(items);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (mounted) setLoadFailed(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [cliente?.Id]);

  const professionals = useMemo(() => {
    const names = appointments.flatMap((appointment) =>
      appointment.ServicosDetalhados?.length
        ? appointment.ServicosDetalhados.map((item) => formatPersonName(item.ProfissionalNome))
        : (appointment.ProfissionalNome || "").split(" + ").map(formatPersonName),
    );
    return Array.from(new Set([...names, preferences.favoriteProfessional].filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [appointments, preferences.favoriteProfessional]);

  const services = useMemo(() => {
    const names = appointments.flatMap((appointment) =>
      appointment.ServicosDetalhados?.length
        ? appointment.ServicosDetalhados.map((item) => item.Nome.trim())
        : (appointment.ServicoNome || "").split(" + ").map((item) => item.trim()),
    );
    return Array.from(new Set([...names, preferences.favoriteService].filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [appointments, preferences.favoriteService]);

  function changePreference(field: keyof ClientPreferences, value: string) {
    const next = { ...preferences, [field]: value };
    if (!cliente?.Id) return;
    try {
      localStorage.setItem(getPreferenceKey(cliente.Id), JSON.stringify(next));
      setPreferences(next);
    } catch {
      showNotification({
        type: "error",
        title: lang === "pt" ? "Não foi possível salvar" : "Could not save",
        message: lang === "pt"
          ? "Não foi possível salvar suas preferências neste navegador."
          : "Could not save preferences in this browser.",
      });
    }
  }

  function backToProfile() {
    navigate("/cliente-final/home", { state: { section: "perfil" } });
  }

  return (
    <div className={styles.container}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <img src={logoNexoCeo} alt="" aria-hidden="true" />
          <strong>NexoCeo</strong>
        </div>
      </header>
      <main className={styles.content}>
        <button type="button" className={styles.back} onClick={backToProfile}>
          <FaArrowLeft aria-hidden="true" />
          {lang === "pt" ? "Voltar ao perfil" : "Back to profile"}
        </button>
        <div className={styles.heading}>
          <span className={styles.headingIcon}><FaCalendarAlt aria-hidden="true" /></span>
          <div>
            <h1>{lang === "pt" ? "Minhas preferências" : "My preferences"}</h1>
            <p>{lang === "pt"
              ? "Escolha os profissionais e serviços que você mais gosta."
              : "Choose the professionals and services you like most."}</p>
          </div>
        </div>

        <section className={styles.preferencesCard} aria-label={lang === "pt" ? "Escolhas favoritas" : "Favorite choices"}>
          <label htmlFor="client-favorite-professional">
            <FaUser aria-hidden="true" />
            {lang === "pt" ? "Profissional favorito" : "Favorite professional"}
          </label>
          <select
            id="client-favorite-professional"
            value={preferences.favoriteProfessional}
            disabled={loading}
            onChange={(event) => changePreference("favoriteProfessional", event.target.value)}
          >
            <option value="">{lang === "pt" ? "Nenhum selecionado" : "None selected"}</option>
            {professionals.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <label htmlFor="client-favorite-service">
            <FaCut aria-hidden="true" />
            {lang === "pt" ? "Serviço favorito" : "Favorite service"}
          </label>
          <select
            id="client-favorite-service"
            value={preferences.favoriteService}
            disabled={loading}
            onChange={(event) => changePreference("favoriteService", event.target.value)}
          >
            <option value="">{lang === "pt" ? "Nenhum selecionado" : "None selected"}</option>
            {services.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {loading && (
            <p role="status">{lang === "pt" ? "Carregando opções..." : "Loading options..."}</p>
          )}
          {loadFailed && (
            <p role="status">{lang === "pt"
              ? "Não foi possível atualizar a lista. Suas preferências salvas foram mantidas."
              : "Could not refresh the list. Your saved preferences have been kept."}</p>
          )}
          <p className={styles.note}>{lang === "pt"
            ? "Os favoritos são sugeridos com base no seu histórico e salvos neste navegador."
            : "Favorites are suggested from your history and saved in this browser."}</p>
        </section>
      </main>
    </div>
  );
}
