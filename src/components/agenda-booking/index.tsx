import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import Modal from "@/components/modal";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { useNotification } from "@/context/NotificationContext";
import { criarAgendamento, formatAgendaDateParam, listarClientesAgendamento, listarHorariosDisponiveis, listarProfissionaisAgendamento } from "@/services/agendamento-service";
import { listarServicosPorEmpresa, listarServicosPorProfissional } from "@/services/servico-service";
import { obterStatusVinculoProfissional } from "@/services/vinculo-service";
import type { HorarioDisponivel, ProfissionalAgendamento, UsuarioAgendamento } from "@/types/agendamento";
import type { Servico } from "@/types/servico";
import styles from "./style.module.css";
import { formatPersonName } from "@/context/UserContext";

type Props = { date: Date; professionalId: number; onClose: () => void; onCreated: (date: string) => void };

export default function AgendaBooking({ date, professionalId, onClose, onCreated }: Props) {
  const { usuario } = useUser();
  const { t } = useLanguage();
  const { showNotification } = useNotification();
  const { themeName } = useTheme();
  const [responsavelId, setResponsavelId] = useState(0);
  const [profissionalId, setProfissionalId] = useState(0);
  const [profissionais, setProfissionais] = useState<ProfissionalAgendamento[]>([]);
  const [clientes, setClientes] = useState<UsuarioAgendamento[]>([]);
  const [clienteId, setClienteId] = useState(0);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientesBusca, setClientesBusca] = useState<UsuarioAgendamento[]>([]);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [erroBuscaClientes, setErroBuscaClientes] = useState(false);
  const [indiceSugestao, setIndiceSugestao] = useState(-1);
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
        if (active) showNotification({ type: "error", title: t("booking.new"), message: t("booking.loadFailed") });
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [usuario, empresa, professionalId, t, showNotification]);

  useEffect(() => {
    if (clienteId || buscaCliente.trim().length < 3) {
      setClientesBusca([]);
      setBuscandoClientes(false);
      return;
    }
    setBuscandoClientes(true);
    setErroBuscaClientes(false);
    let active = true;
    const delay = window.setTimeout(() => {
      void listarClientesAgendamento(buscaCliente.trim())
        .then(items => { if (active) { setClientesBusca(items); setErroBuscaClientes(false); } })
        .catch(() => { if (active) { setClientesBusca([]); setErroBuscaClientes(true); } })
        .finally(() => { if (active) setBuscandoClientes(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(delay); };
  }, [buscaCliente]);

  useEffect(() => {
    let active = true;
    setServicos([]); setServicoId(0); setSlots([]); setSlot("");
    if (!responsavelId || (empresa && !profissionalId)) { setLoadingServices(false); return; }
    setLoadingServices(true);
    const request = profissionalId
      ? listarServicosPorProfissional(profissionalId, responsavelId)
      : listarServicosPorEmpresa(responsavelId);
    void request.then(items => { if (active) setServicos(items); })
      .catch(() => { if (active) showNotification({ type: "error", title: t("booking.new"), message: t("booking.loadFailed") }); })
      .finally(() => { if (active) setLoadingServices(false); });
    return () => { active = false; };
  }, [responsavelId, profissionalId, empresa, t, showNotification]);

  useEffect(() => {
    let active = true;
    setSlots([]); setSlot("");
    if (!responsavelId || !servicoId || !day) { setLoadingSlots(false); return; }
    setLoadingSlots(true);
    void listarHorariosDisponiveis({ responsavelId, profissionalId: profissionalId || undefined, servicoId, data: day })
      .then(items => {
        if (!active) return;
        setSlots(items);
        if (items.length === 0) {
          showNotification({
            type: "warning",
            title: t("client.availableSlots"),
            message: t("client.slotsEmpty"),
          });
        }
      })
      .catch(() => { if (active) showNotification({ type: "error", title: t("booking.new"), message: t("booking.loadFailed") }); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [responsavelId, profissionalId, servicoId, day, revision, t, showNotification]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || loading || loadingServices || loadingSlots || !clienteId || !servicoId || !slots.some(s => s.DataAgendamento === slot)) return;
    setSaving(true); 
    try {
      await criarAgendamento({ ClienteId: clienteId, ResponsavelId: responsavelId, ProfissionalId: profissionalId || undefined, ServicoId: servicoId, DataAgendamento: slot });
    } catch (err) {
      const data = axios.isAxiosError<{ erro?: string }>(err) ? err.response?.data : undefined;
      showNotification({ type: "error", title: t("booking.new"), message: data?.erro || t("booking.saveFailed") });
      setRevision(value => value + 1);
      setSaving(false);
      return;
    }
    onCreated(day);
  }

  return <Modal open title={t("booking.new")} onClose={onClose} busy={saving}>
    <form className={styles.form} onSubmit={submit}>
        <fieldset disabled={loading || saving} aria-busy={loading}>
          {empresa && profissionais.length > 1 && <label>{t("common.professional")}
            <select required value={profissionalId} onChange={e => { setProfissionalId(Number(e.target.value));  }}>
              <option value={0} disabled hidden>{t("booking.select")}</option>
              {profissionais.map(p => <option key={p.Id} value={p.Id}>{formatPersonName(p.Nome)}</option>)}
            </select>
          </label>}
          <div className={styles.clientField}>
            <label htmlFor="booking-client-search">{t("booking.customer")}</label>
            <div className={styles.clientAutocomplete}>
              <input id="booking-client-search" type="search" autoComplete="off"
                role="combobox" aria-autocomplete="list" aria-controls="booking-client-options"
                aria-expanded={sugestoesAbertas} aria-activedescendant={indiceSugestao >= 0 ? `booking-client-option-${indiceSugestao}` : undefined}
                value={buscaCliente} maxLength={80}
                placeholder="Digite o nome do cliente"
                onFocus={() => { if (!clienteId) setSugestoesAbertas(true); }}
                onBlur={() => window.setTimeout(() => setSugestoesAbertas(false), 120)}
                onChange={event => {
                  setBuscaCliente(event.target.value);
                  setClienteId(0);
                  setIndiceSugestao(-1);
                  setSugestoesAbertas(true);
                }}
                onKeyDown={event => {
                  const options = buscaCliente.trim().length >= 3 ? clientesBusca : clientes;
                  if (event.key === "Escape") setSugestoesAbertas(false);
                  if (event.key === "ArrowDown" && options.length > 0) {
                    event.preventDefault();
                    setSugestoesAbertas(true);
                    setIndiceSugestao(current => (current + 1) % options.length);
                  }
                  if (event.key === "ArrowUp" && options.length > 0) {
                    event.preventDefault();
                    setSugestoesAbertas(true);
                    setIndiceSugestao(current => (current - 1 + options.length) % options.length);
                  }
                  if (event.key === "Enter" && sugestoesAbertas && indiceSugestao >= 0 && options[indiceSugestao]) {
                    event.preventDefault();
                    const selected = options[indiceSugestao];
                    setClienteId(selected.Id);
                    setBuscaCliente(formatPersonName(selected.Nome));
                    setSugestoesAbertas(false);
                    setIndiceSugestao(-1);
                  }
                }} />
              {sugestoesAbertas && !clienteId && (
                <div id="booking-client-options" className={styles.clientOptions} role="listbox">
                  {buscandoClientes && <div className={styles.clientHint}>Buscando clientes...</div>}
                  {!buscandoClientes && (buscaCliente.trim().length >= 3 ? clientesBusca : clientes).map((cliente, index) => (
                    <button type="button" role="option" id={`booking-client-option-${index}`}
                      aria-selected={index === indiceSugestao}
                      className={styles.clientOption} key={cliente.Id}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        setClienteId(cliente.Id);
                        setBuscaCliente(formatPersonName(cliente.Nome));
                        setSugestoesAbertas(false);
                        setIndiceSugestao(-1);
                      }}>{formatPersonName(cliente.Nome)}</button>
                  ))}
                  {!buscandoClientes && erroBuscaClientes && <div className={styles.clientHint}>Não foi possível consultar clientes. Tente novamente.</div>}
                  {!buscandoClientes && !erroBuscaClientes && buscaCliente.trim().length >= 3 && clientesBusca.length === 0 &&
                    <div className={styles.clientHint}>Nenhum cliente encontrado.</div>}
                  {!buscandoClientes && buscaCliente.trim().length < 3 && clientes.length === 0 &&
                    <div className={styles.clientHint}>Digite pelo menos 3 letras para buscar clientes.</div>}
                </div>
              )}
            </div>
          </div>
          <label>{t("booking.service")}
            <select required value={servicoId} disabled={loadingServices || !responsavelId || (empresa && !profissionalId)} onChange={e => { setServicoId(Number(e.target.value));  }}>
              <option value={0} disabled hidden>{t("booking.select")}</option>
              {servicos.map(s => <option key={s.Id} value={s.Id}>{s.NomeServico} · {s.TempoEstimadoMinutos} min</option>)}
            </select>
          </label>
          {!loading && !loadingServices && responsavelId > 0 && (!empresa || profissionalId > 0) && servicos.length === 0 && <p>{t("booking.noServices")}</p>}
          <label>{t("client.date")}<input required type="date" style={{ colorScheme: themeName === "dark" ? "dark" : "light" }} min={formatAgendaDateParam(new Date())} value={day} onChange={e => { setDay(e.target.value);  }} /></label>
          <label>{t("client.availableSlots")}
            <select required disabled={!servicoId || loadingSlots} value={slot} onChange={e => setSlot(e.target.value)}>
              <option value="" disabled hidden>{t("booking.select")}</option>
              {slots.map(s => <option key={s.DataAgendamento} value={s.DataAgendamento}>{s.Horario}</option>)}
            </select>
          </label>
          
        </fieldset>
      <div className={styles.actions}>
        <button type="button" disabled={saving} onClick={onClose}>{t("common.close")}</button>
        <button type="submit" disabled={loading || loadingServices || loadingSlots || saving || !clienteId || !servicoId || !slot}>{saving ? t("booking.saving") : t("booking.confirm")}</button>
      </div>
    </form>
  </Modal>;
}
