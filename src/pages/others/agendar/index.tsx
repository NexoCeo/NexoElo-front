import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/services/api";
import styles from "./style.module.css";

type Disponibilidade = {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
};

export default function Agendar() {
  const { username } = useParams();

  const [horarios, setHorarios] = useState<Date[]>([]);
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [whatsLink, setWhatsLink] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      const response = await api.get<Disponibilidade[]>(
        `/disponibilidade/${username}`,
      );

      const horariosGerados = gerarHorariosProximos(response.data);
      setHorarios(horariosGerados);
    };

    void carregar();
  }, [username]);

  const gerarHorariosProximos = (
    disponibilidades: Disponibilidade[],
  ): Date[] => {
    const hoje = new Date();
    const diasGerados: Date[] = [];

    for (let diaOffset = 0; diaOffset < 7; diaOffset++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + diaOffset);

      const diaSemana = data.getDay();

      const disponivelHoje = disponibilidades.find(
        (disponibilidade) =>
          disponibilidade.diaSemana === diaSemana,
      );

      if (!disponivelHoje) {
        continue;
      }

      const [horaInicio, minutoInicio] = disponivelHoje.horaInicio
        .split(":")
        .map(Number);

      const [horaFim, minutoFim] = disponivelHoje.horaFim
        .split(":")
        .map(Number);

      const inicio = new Date(data);
      inicio.setHours(horaInicio, minutoInicio, 0, 0);

      const fim = new Date(data);
      fim.setHours(horaFim, minutoFim, 0, 0);

      while (inicio < fim) {
        diasGerados.push(new Date(inicio));
        inicio.setMinutes(inicio.getMinutes() + 30);
      }
    }

    return diasGerados;
  };

  const agendar = async () => {
    if (
      !username ||
      !dataSelecionada ||
      !nomeCliente.trim() ||
      !telefone.trim()
    ) {
      window.alert("Preencha todos os campos");
      return;
    }

    const response = await api.post(
      `/agendamentos/${username}`,
      {
        nomeCliente: nomeCliente.trim(),
        telefoneCliente: telefone.trim(),
        dataHora: dataSelecionada,
        observacoes: "",
      },
    );

    setWhatsLink(response.data.whatsappLink);
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        <h2 className={styles.title}>
          Agende com{" "}
          <span className={styles.name}>
            {username}
          </span>
        </h2>

        <input
          className={styles.input}
          placeholder="Seu nome"
          value={nomeCliente}
          onChange={(event) => {
            setNomeCliente(event.target.value);
          }}
        />

        <input
          className={styles.input}
          placeholder="Seu telefone (ex: 5527997333212)"
          value={telefone}
          onChange={(event) => {
            setTelefone(event.target.value);
          }}
        />

        <h4 className={styles.subtitle}>
          Escolha um horário:
        </h4>

        <div className={styles.horariosContainer}>
          {horarios.map((horario) => {
            const horarioIso = horario.toISOString();
            const selecionado = dataSelecionada === horarioIso;

            return (
              <button
                key={horarioIso}
                type="button"
                onClick={() => {
                  setDataSelecionada(horarioIso);
                }}
                className={`${styles.horarioBtn} ${
                  selecionado ? styles.selected : ""
                }`}
              >
                {horario.toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.confirmBtn}
          onClick={() => {
            void agendar();
          }}
        >
          Confirmar agendamento
        </button>

        {whatsLink && (
          <div className={styles.whatsappLinkContainer}>
            <p>Toque abaixo para abrir no WhatsApp:</p>

            <a
              href={whatsLink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsLink}
            >
              {whatsLink}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
