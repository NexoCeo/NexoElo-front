import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";


import styles from './style.module.css';

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
      const res = await axios.get(`http://localhost:5000/api/disponibilidade/${username}`);
      const horariosGerados: Date[] = gerarHorariosProximos(res.data);
      setHorarios(horariosGerados);
    };
    carregar();
  }, [username]);

  const gerarHorariosProximos = (disponibilidades: Disponibilidade[]) => {
    const hoje = new Date();
    const diasGerados: Date[] = [];

    for (let diaOffset = 0; diaOffset < 7; diaOffset++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + diaOffset);
      const diaSemana = data.getDay();

      const disponivelHoje = disponibilidades.find((d) => d.diaSemana === diaSemana);
      if (disponivelHoje) {
        const [hIniH, hIniM] = disponivelHoje.horaInicio.split(":").map(Number);
        const [hFimH, hFimM] = disponivelHoje.horaFim.split(":").map(Number);

        const inicio = new Date(data);
        inicio.setHours(hIniH, hIniM, 0, 0);

        const fim = new Date(data);
        fim.setHours(hFimH, hFimM, 0, 0);

        while (inicio < fim) {
          diasGerados.push(new Date(inicio));
          inicio.setMinutes(inicio.getMinutes() + 30);
        }
      }
    }
    return diasGerados;
  };

  const agendar = async () => {
    if (!dataSelecionada || !nomeCliente || !telefone) return alert("Preencha todos os campos");

    const res = await axios.post(`http://localhost:5000/api/agendamentos/${username}`, {
      nomeCliente,
      telefoneCliente: telefone,
      dataHora: dataSelecionada,
      observacoes: ""
    });

    setWhatsLink(res.data.whatsappLink);
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        <h2 className={styles.title}>
          Agende com <span className={styles.name}> {username} </span>
        </h2>

        <input
          className={styles.input}
          placeholder="Seu nome"
          value={nomeCliente}
          onChange={(e) => setNomeCliente(e.target.value)}
        />

        <input
          className={styles.input}
          placeholder="Seu telefone (ex: 5527997333212)"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
        />

        <h4 className={styles.subtitle}>Escolha um horário:</h4>

        <div className={styles.horariosContainer}>
          {horarios.map((h, i) => (
            <button
              key={i}
              onClick={() => setDataSelecionada(h.toISOString())}
              className={`${styles.horarioBtn} ${dataSelecionada === h.toISOString() ? styles.selected : ""}`}
            >
              {h.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </button>
          ))}
        </div>

        <button className={styles.confirmBtn} onClick={agendar}>
          Confirmar Agendamento
        </button>

        {whatsLink && (
          <div className={styles.whatsappLinkContainer}>
            <p>Toque abaixo para abrir no WhatsApp:</p>
            <a href={whatsLink} target="_blank" rel="noopener noreferrer" className={styles.whatsLink}>
              {whatsLink}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
