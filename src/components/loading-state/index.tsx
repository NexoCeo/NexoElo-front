import styles from "./style.module.css";

type LoadingStateProps = {
  label?: string;
  compact?: boolean;
  dense?: boolean;
  embedded?: boolean;
  variant?: "cards" | "table" | "form" | "profile" | "analytics" | "agenda" | "services" | "hours" | "reports" | "dashboard" | "professionals" | "metrics" | "subscription" | "whatsapp" | "client-home" | "client-history" | "agenda-list" | "client-providers" | "client-services" | "client-professionals" | "client-slots";
};

function inferVariant(): NonNullable<LoadingStateProps["variant"]> {
  const path = typeof window === "undefined" ? "" : window.location.pathname.toLowerCase();
  // Route-specific skeletons must follow the current UI, not the old table layouts.
  if (path.includes("/analise-dados/metricas")) return "metrics";
  if (path.includes("/analise-dados/whatsapp-business")) return "whatsapp";
  if (path.includes("/cliente-final/home")) return "client-home";
  if (path.includes("/cliente-final/agendar")) return "client-providers";
  if (path.endsWith("/dashboard") || path.endsWith("/home")) return "dashboard";
  if (path.endsWith("/agenda")) return "agenda";
  if (path.endsWith("/servicos")) return "services";
  if (path.endsWith("/profissionais")) return "professionals";
  if (path.endsWith("/funcionamento")) return "hours";
  if (path.endsWith("/relatorios")) return "reports";
  if (path.includes("/assinatura")) return "subscription";
  if (path.endsWith("/perfil")) return "profile";
  if (path.includes("/login") || path.includes("/register") || path.includes("/recuperarsenha")) return "form";
  return "cards";
}

function Bar({ width = "100%" }: { width?: string }) {
  return <span aria-hidden="true" className={styles.bar} style={{ width }} />;
}


type Variant = NonNullable<LoadingStateProps["variant"]>;

function SkeletonHeader({ action = false }: { action?: boolean }) {
  return <div className={styles.skHeader}>
    <div className={styles.skHeading}>
      <span className={styles.skIcon} aria-hidden="true" />
      <div><Bar width="56%" /><Bar width="80%" /></div>
    </div>
    {action && <span className={styles.skAction} aria-hidden="true" />}
  </div>;
}

function SkeletonStat({ index }: { index: number }) {
  return <div className={styles.skStat}>
    <span className={styles.skIcon} aria-hidden="true" />
    <div><Bar width={index === 1 ? "68%" : "44%"} /><Bar width="80%" /></div>
  </div>;
}
function SkeletonStats({ count = 4 }: { count?: number }) {
  return <div className={styles.skStats} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <SkeletonStat index={index} key={index} />)}
  </div>;
}
function SkeletonAppointment({ index }: { index: number }) {
  return <article className={styles.skAppointment} aria-hidden="true">
    <div className={styles.skBetween}><Bar width={index % 2 ? "52%" : "46%"} /><Bar width="63px" /></div>
    <div className={styles.skBetween}><Bar width="38%" /><Bar width="64px" /></div>
    <Bar width="31%" />
    <div className={styles.skAppointmentBottom}><Bar width="74px" /><span className={styles.skSmallButton} /></div>
  </article>;
}
function SkeletonAppointments({ count = 3 }: { count?: number }) {
  return <div className={styles.skAppointments}>
    {Array.from({ length: count }, (_, index) => <SkeletonAppointment index={index} key={index} />)}
  </div>;
}
function SkeletonCalendar() {
  return <div className={styles.skCalendar} aria-hidden="true">
    <div className={styles.skCalendarHeading}><span className={styles.skDateBar} /><Bar width="32%" /><span className={styles.skDateBar} /></div>
    <div className={styles.skCalendarDays}>
      {Array.from({ length: 7 }, (_, index) => <div key={index}><Bar width="70%" /><span className={styles.skDay} /></div>)}
    </div>
    <span className={styles.skCalendarButton} />
  </div>;
}
function SkeletonTimeline() {
  return <div className={styles.skTimeline} aria-hidden="true">
    <div className={styles.skPanelHeading}><Bar width="68%" /><Bar width="35%" /></div>
    <div className={styles.skTimelineRows}>
      {Array.from({ length: 7 }, (_, index) => <div className={styles.skTimeRow} key={index}>
        <Bar width="38px" /><span />
      </div>)}
    </div>
  </div>;
}
function SkeletonPanel({ type = "lines" }: { type?: "lines" | "chart" | "bars" }) {
  return <div className={styles.skPanel} aria-hidden="true">
    <div className={styles.skPanelHeading}><Bar width="43%" /><Bar width="16%" /></div>
    {type === "chart"
      ? <div className={styles.skChart}><span className={styles.skChartArea} /></div>
      : type === "bars" ? <div className={styles.skBarChart}>{[22, 44, 38, 68, 56].map((height, index) =>
        <span style={{ height: height + "%" }} key={index} />)}</div>
      : <div className={styles.skPanelLines}>
        {[0,1,2].map(i => <div className={styles.skBetween} key={i}><Bar width="26%" /><Bar width="48%" /><Bar width="14%" /></div>)}
      </div>}
  </div>;
}
function SkeletonListRow({ index, photo = false }: { index: number; photo?: boolean }) {
  return <div className={styles.skListRow} key={index} aria-hidden="true">
    <div className={styles.skListIdentity}>
      <span className={photo ? styles.skPhoto : styles.skIcon} />
      <div><Bar width={index % 2 ? "78%" : "67%"} /><Bar width="54%" /></div>
    </div>
    <Bar width="59%" /><Bar width="70%" /><Bar width="66%" />
    <span className={styles.skSmallButton} />
  </div>;
}
function SkeletonToolbar({ options = true }: { options?: boolean }) {
  return <div className={styles.skToolbar} aria-hidden="true">
    <div className={styles.skSearch}><Bar width="48%" /></div>
    {options && <div className={styles.skPills}>{[0,1,2,3].map(i => <span key={i} />)}</div>}
  </div>;
}
function ContextualSkeleton({ kind, embedded }: { kind: Variant; embedded: boolean }) {
  if (kind === "dashboard" && embedded) return <SkeletonAppointments count={2} />;
  if (kind === "dashboard") return <div className={styles.skDashboard}>
    <div className={styles.skDashboardHeader}>
      <div className={styles.skDashboardTitle}><Bar width="70%" /><Bar width="80%" /></div>
      <span className={styles.skAction} />
    </div>
    <SkeletonAppointments count={2} />
  </div>;

  if (kind === "agenda") return <div className={styles.skPage}>
    <SkeletonHeader action />
    <SkeletonStats />
    <div className={styles.skAgendaGrid}>
      <SkeletonCalendar />
      <SkeletonTimeline />
      <div className={styles.skAgendaList}>
        <div className={styles.skPanelHeading}><Bar width="70%" /><Bar width="20%" /></div>
        {[0,1,2].map(i => <div className={styles.skMiniBooking} key={i}><Bar width="50%" /><Bar width="70%" /><Bar width="36%" /></div>)}
        <div className={styles.skAgendaFooter}><Bar width="70%" /></div>
      </div>
    </div>
  </div>;

  if (kind === "services" || kind === "professionals") return <div className={styles.skPage}>
    <div className={styles.skActions}><span className={styles.skAction} />{kind === "professionals" && <span className={styles.skAction} />}</div>
    <SkeletonStats />
    <SkeletonToolbar />
    <div className={styles.skList}>
      {Array.from({ length: 4 }, (_, i) => <SkeletonListRow key={i} index={i} photo={kind === "professionals"} />)}
    </div>
  </div>;

  if (kind === "metrics" || kind === "analytics") return <div className={styles.skPage}>
    <div className={styles.skMetricFilters}><span className={styles.skFilter} /><span className={styles.skFilter} /></div>
    <SkeletonStats />
    <div className={styles.skCharts}><SkeletonPanel type="chart" /><SkeletonPanel type="bars" /></div>
    <div className={styles.skInsights}><SkeletonPanel /><SkeletonPanel /></div>
    <SkeletonPanel type="bars" />
  </div>;

  if (kind === "subscription") return <div className={styles.skPage}>
    <SkeletonHeader action />
    <div className={styles.skStats}><SkeletonStat index={0} /><SkeletonStat index={1} /><SkeletonStat index={2} /></div>
    <div className={styles.skPlans}>{[0,1,2].map(i => <div className={styles.skPlan} key={i}>
      <Bar width="55%" /><Bar width="68%" />{[0,1,2,3,4].map(j => <Bar width={j%2?"85%":"70%"} key={j} />)}
      <span className={styles.skAction} />
    </div>)}</div>
  </div>;

  if (kind === "whatsapp") return <div className={styles.skPage}>
    <SkeletonHeader action />
    <div className={styles.skWhatsAppHero}><Bar width="30%" /><Bar width="68%" /><Bar width="52%" /></div>
    <SkeletonStats />
    <div className={styles.skInsights}><SkeletonPanel /><SkeletonPanel /></div>
  </div>;

  if (kind === "profile") return <div className={styles.skPage}>
    <div className={styles.skProfileHero}>
      <span className={styles.skPhotoLarge} />
      <div><Bar width="47%" /><Bar width="65%" /><Bar width="38%" /></div>
      <span className={styles.skAction} />
    </div>
    <div className={styles.skProfileFields}>
      {[0,1,2,3].map(i => <div className={styles.skProfileField} key={i}><Bar width="36%" /><Bar width="65%" /></div>)}
    </div>
  </div>;

  if (kind === "agenda-list") return <div className={styles.skCompactAgendaList} aria-hidden="true">
    {Array.from({ length: 3 }, (_, i) => <div className={styles.skCompactBooking} key={i}>
      <span className={styles.skIcon} />
      <div><Bar width="68%" /><Bar width="52%" /><Bar width="33%" /></div>
      <Bar width="66px" />
    </div>)}
  </div>;

  if (kind === "client-home" || kind === "client-history") return <div className={styles.skClientCards}>
    {Array.from({ length: kind === "client-home" ? 1 : 3 }, (_, i) =>
      <div className={styles.skClientCard} key={i}>
        <span className={styles.skIcon} /><div><Bar width="63%" /><Bar width="85%" /><Bar width="45%" /></div>
        <Bar width="74px" />
      </div>)}
  </div>;

  return null;
}

export default function LoadingState({ label = "Carregando", compact = false, dense = false, embedded = false, variant }: LoadingStateProps) {
  const kind = variant ?? inferVariant();
  return (
    <div className={`${styles.loading} ${compact ? styles.compact : ""} ${dense ? styles.dense : ""} ${embedded ? styles.embedded : ""}`} role="status" aria-live="polite" aria-label={label} aria-busy="true">
      <span className={styles.srOnly}>{label}</span>
      {!compact && (["dashboard", "agenda", "services", "professionals", "metrics", "analytics", "subscription", "whatsapp", "profile", "client-home", "client-history", "agenda-list"] as Variant[]).includes(kind) ? (
        <ContextualSkeleton kind={kind} embedded={embedded} />
      ) : !compact && kind === "reports" ? (
        <div className={styles.reportsShell} aria-hidden="true">
          <div className={styles.reportsHeader}>
            <div className={styles.reportsPeriod}><Bar width="62%"/><Bar width="100%"/></div>
          </div>
          <div className={styles.reportsGrid}>
            {[0,1,2].map(i => <div key={i} className={styles.reportsCard}>
              <div className={styles.reportsCardHead}><span className={styles.reportsIcon}/><Bar width="18%"/></div>
              <div className={styles.reportsCardContent}><Bar width="75%"/><Bar width="92%"/><Bar width="68%"/></div>
              <div className={styles.reportsCardActions}><Bar width="100%"/><Bar width="100%"/></div>
            </div>)}
          </div>
        </div>
      ) : !compact && kind === "hours" ? (
        <div className={`${styles.hoursShell} ${embedded ? styles.hoursEmbedded : ""}`} aria-hidden="true">
          {!embedded && <>
            <div className={styles.hoursIntro}><Bar width="32%"/><Bar width="58%"/></div>
            <div className={styles.hoursStepper}>{[0,1,2,3,4].map(i => <div key={i}><span className={styles.hoursStepCircle}/><Bar width="55%" /></div>)}</div>
          </>}
          <div className={styles.hoursColumns}>
            <div className={styles.hoursEditor}>
              <div className={styles.hoursPanel}>
                <div className={styles.hoursHead}><Bar width="45%"/><Bar width="30%"/></div>
                <div className={styles.hoursDays}>{Array.from({length:7},(_,i)=><div key={i} className={styles.hoursDay}><Bar width="60%"/><Bar width="75%"/></div>)}</div>
              </div>
              <div className={styles.hoursPanel}><div className={styles.hoursHead}><Bar width="40%"/><Bar width="20%"/></div><div className={styles.hoursInputs}><Bar width="100%"/><Bar width="100%"/></div></div>
              <div className={styles.hoursPanel}><div className={styles.hoursHead}><Bar width="48%"/></div>{[0,1,2].map(i=><div className={styles.hoursLine} key={i}><Bar width="34%"/><Bar width="40%"/></div>)}</div>
              <div className={styles.hoursPanel}><div className={styles.hoursHead}><Bar width="38%"/><Bar width="18%"/></div><Bar width="55%"/></div>
            </div>
            {!embedded && <aside className={styles.hoursSummary}><Bar width="65%"/>{[0,1,2].map(i=><div className={styles.hoursSummaryRow} key={i}><Bar width="50%"/><Bar width="76%"/></div>)}</aside>}
          </div>
        </div>
      ) : !compact && kind === "services" ? (
        <div className={`${styles.servicesShell} ${embedded ? styles.servicesEmbedded : ""}`} aria-hidden="true">
          {!embedded && <div className={styles.servicesToolbar}><Bar width="100%"/></div>}
          <div className={styles.servicesTable}>
            <div className={styles.servicesColumns}>
              {[0,1,2,3,4].map(i => <Bar key={i} width={i===0?"60%":"50%"} />)}
            </div>
            {[0,1,2].map(i => (
              <div className={styles.servicesRow} key={i}>
                <div className={styles.servicesIdentity}><span className={styles.servicesImage}/><Bar width="65%"/></div>
                <Bar width="34%"/><Bar width="40%"/><Bar width="65%"/><Bar width="34%"/>
              </div>
            ))}
          </div>
        </div>
      ) : !compact && kind === "agenda" ? (
        <div className={styles.agendaShell}>
          <aside className={styles.agendaSide} aria-hidden="true">
            <div className={styles.agendaToggle}><Bar width="45%"/><Bar width="42%"/></div>
            <div className={styles.agendaCalendar}>
              <Bar width="100%"/>
              <div className={styles.agendaDays}>{Array.from({length:35},(_,i)=><Bar key={i} width="65%"/>)}</div>
            </div>
            {[0,1,2].map(i=><div key={i} className={styles.agendaAction}><Bar width="68%"/></div>)}
          </aside>
          <section className={styles.agendaMain} aria-hidden="true">
            <div className={styles.agendaHeading}><div><Bar width="65%"/><Bar width="40%"/></div><Bar width="20%"/></div>
            <div className={styles.agendaTable}>
              <div className={styles.agendaTableHeader}>{Array.from({length:7},(_,i)=><Bar key={i} width="60%"/>)}</div>
              <div className={styles.agendaTableBody}>{[0,1,2,3,4].map(i=><div className={styles.agendaTableRow} key={i}>{[0,1,2,3,4,5,6].map(j=><Bar key={j} width={j===0?"75%":"58%"}/>)}</div>)}</div>
            </div>
          </section>
        </div>
      ) : compact && ["client-providers", "client-professionals", "client-services", "client-slots"].includes(kind) ? (
        <div className={kind === "client-slots" ? styles.skSlots : styles.skCompactCards} aria-hidden="true">
          {Array.from({ length: kind === "client-slots" ? 6 : 3 }, (_, index) =>
            kind === "client-slots"
              ? <span className={styles.skSlot} key={index} />
              : <div className={styles.skCompactCard} key={index}>
                  <span className={styles.skPhoto} />
                  <div><Bar width={index % 2 ? "70%" : "80%"} /><Bar width="52%" /><Bar width="65%" /></div>
                  <span className={styles.skSmallButton} />
                </div>
          )}
        </div>
      ) : compact ? <div className={styles.compactLines}><Bar width="65%"/><Bar width="86%"/><Bar width="44%"/></div> : (
        <div className={styles.page}>
          {kind === "profile" ? (
            <div className={styles.profile}>
              <span className={styles.avatar}/>
              <Bar width="35%"/><Bar width="20%"/>
              <div className={styles.profileInfo}><Bar width="65%"/><Bar width="80%"/></div>
              <Bar width="44%"/>
            </div>
          ) : kind === "form" ? (
            <div className={styles.form}>
              <Bar width="56%"/>
              {[0, 1, 2, 3].map(i => <div className={styles.field} key={i}><Bar width="26%"/><span className={styles.input}/></div>)}
              <span className={styles.input}/>
            </div>
          ) : (
            <>
              <div className={styles.intro}><Bar width="30%"/><Bar width="47%"/></div>
              {kind === "analytics" && <div className={styles.metrics}>{[0,1,2].map(i =>
                <div className={styles.tile} key={i}><Bar width="43%"/><Bar width="27%"/><Bar width="65%"/></div>)}</div>}
              <div className={styles.panel}>
                <div className={styles.panelHead}><Bar width="24%"/><Bar width="15%"/></div>
                {kind === "cards" ? <div className={styles.metrics}>{[0,1,2].map(i =>
                  <div className={styles.tile} key={i}><Bar width="45%"/><Bar width="85%"/><Bar width="58%"/></div>)}</div>
                  : [0,1,2,3,4].map(i => <div className={styles.tableRow} key={i}>
                    <Bar width="22%"/><Bar width="30%"/><Bar width="16%"/><Bar width="12%"/>
                  </div>)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
