import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import Modal from "@/components/modal";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import { criarAgendamento, formatAgendaDateParam, listarClientesAgendamento, listarHorariosDisponiveis, listarProfissionaisAgendamento } from "@/services/agendamento-service";
import { listarServicosPorEmpresa, listarServicosPorProfissional } from "@/services/servico-service";
import { obterStatusVinculoProfissional } from "@/services/vinculo-service";
import type { HorarioDisponivel, ProfissionalAgendamento, UsuarioAgendamento } from "@/types/agendamento";
import type { Servico } from "@/types/servico";
import styles from "./style.module.css";

type Props = { date: Date; professionalId: number; onClose: () => void; onCreated: (date: string) => void };

export default function AgendaBooking({ date, professionalId, onClose, onCreated }: Props) {
  const { usuario } = useUser();
  const { t } = useLanguage();
  const [responsavelId, setResponsavelId] = useState(0);
  const [profissionalId, setProfissionalId] = useState(0);
  const [profissionais, setProfissionais] = useState<ProfissionalAgendamento[]>([]);
  const [clientes, setClientes] = useState<UsuarioAgendamento[]>([]);
  const [clienteId, setClienteId] = useState(0);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [servicoId, setServicoId] = useState(0);
  const [day, setDay] = useState(formatAgendaDateParam(date));
  const [slots, setSlots] = useState<HorarioDisponivel[]>([]);
  const [slot, setSlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const empresa = usuario?.Papel === "EMPRESA";

  useEffect(() => {
    let active = true;
    async function load() {
      if (!usuario) return;
      try {
        const [customers, context] = await Promise.all([
          listarClientesAgendamento(),
          usuario.Papel === "PROFISSIONAL" ? obterStatusVinculoProfissional() : Promise.resolve(null),
        ]);
        if (!active) return;
        if (context && (context.status !== "APROVADO" || !context.empresaId)) throw new Error();
        const owner = context?.empresaId || usuario.Id;
        const professionals = empresa ? await listarProfissionaisAgendamento(owner) : [];
        if (!active) return;
        setClientes(customers);
        setProfissionais(professionals);
        setProfissionalId(context ? usuario.Id : professionals.some(p => p.Id === professionalId) ? professionalId : professionals.length === 1 ? professionals[0].Id : 0);
        setResponsavelId(owner);
      } catch {
        if (active) setError(t("booking.loadFailed"));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [usuario, empresa, professionalId, t]);

  useEffect(() => {
    let active = true;
    setServicos([]); setServicoId(0); setSlots([]); setSlot("");
    if (!responsavelId || (empresa && !profissionalId)) { setLoadingServices(false); return; }
    setLoadingServices(true);
    const request = profissionalId
      ? listarServicosPorProfissional(profissionalId, responsavelId)
      : listarServicosPorEmpresa(responsavelId);
    void request.then(items => { if (active) setServicos(items); })
      .catch(() => { if (active) setError(t("booking.loadFailed")); })
      .finally(() => { if (active) setLoadingServices(false); });
    return () => { active = false; };
  }, [responsavelId, profissionalId, empresa, t]);

  useEffect(() => {
    let active = true;
    setSlots([]); setSlot("");
    if (!responsavelId || !servicoId || !day) { setLoadingSlots(false); return; }
    setLoadingSlots(true);
    void listarHorariosDisponiveis({ responsavelId, profissionalId: profissionalId || undefined, servicoId, data: day })
      .then(items => { if (active) setSlots(items); })
      .catch(() => { if (active) setError(t("booking.loadFailed")); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [responsavelId, profissionalId, servicoId, day, revision, t]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || loading || loadingServices || loadingSlots || !clienteId || !servicoId || !slots.some(s => s.DataAgendamento === slot)) return;
    setSaving(true); setError("");
    try {
      await criarAgendamento({ ClienteId: clienteId, ResponsavelId: responsavelId, ProfissionalId: profissionalId || undefined, ServicoId: servicoId, DataAgendamento: slot });
    } catch (err) {
      const data = axios.isAxiosError<{ erro?: string }>(err) ? err.response?.data : undefined;
      setError(data?.erro || t("booking.saveFailed"));
      setRevision(value => value + 1);
      setSaving(false);
      return;
    }
    onCreated(day);
  }

  return <Modal open title={t("booking.new")} onClose={onClose} busy={saving}>
    <form className={styles.form} onSubmit={submit}>
      {loading ? <p role="status">{t("booking.loading")}</p> : <>
        <fieldset disabled={saving}>
          {empresa && profissionais.length > 1 && <label>{t("common.professional")}
            <select required value={profissionalId} onChange={e => { setProfissionalId(Number(e.target.value)); setError(""); }}>
              <option value={0}>{t("booking.select")}</option>
              {profissionais.map(p => <option key={p.Id} value={p.Id}>{p.Nome}</option>)}
            </select>
          </label>}
          <label>{t("booking.customer")}
            <select required value={clienteId} onChange={e => setClienteId(Number(e.target.value))}>
              <option value={0}>{t("booking.select")}</option>
              {clientes.map(c => <option key={c.Id} value={c.Id}>{c.Nome}</option>)}
            </select>
          </label>
          {clientes.length === 0 && <p>{t("booking.noCustomers")}</p>}
          <label>{t("booking.service")}
            <select required value={servicoId} disabled={loadingServices || !responsavelId || (empresa && !profissionalId)} onChange={e => { setServicoId(Number(e.target.value)); setError(""); }}>
              <option value={0}>{loadingServices ? t("booking.loading") : t("booking.select")}</option>
              {servicos.map(s => <option key={s.Id} value={s.Id}>{s.NomeServico} · {s.TempoEstimadoMinutos} min</option>)}
            </select>
          </label>
          {!loadingServices && responsavelId > 0 && (!empresa || profissionalId > 0) && servicos.length === 0 && <p>{t("booking.noServices")}</p>}
          <label>{t("client.date")}<input required type="date" min={formatAgendaDateParam(new Date())} value={day} onChange={e => { setDay(e.target.value); setError(""); }} /></label>
          <label>{t("client.availableSlots")}
            <select required disabled={!servicoId || loadingSlots} value={slot} onChange={e => setSlot(e.target.value)}>
              <option value="">{loadingSlots ? t("booking.loading") : t("booking.select")}</option>
              {slots.map(s => <option key={s.DataAgendamento} value={s.DataAgendamento}>{s.Horario}</option>)}
            </select>
          </label>
          {servicoId > 0 && day && !loadingSlots && slots.length === 0 && <p>{t("client.slotsEmpty")}</p>}
        </fieldset>
      </>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={saving} onClick={onClose}>{t("common.close")}</button>
        <button type="submit" disabled={loading || loadingServices || loadingSlots || saving || !clienteId || !servicoId || !slot}>{saving ? t("booking.saving") : t("booking.confirm")}</button>
      </div>
    </form>
  </Modal>;
}
