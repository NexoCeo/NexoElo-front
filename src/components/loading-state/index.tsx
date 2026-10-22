import styles from "./style.module.css";

type LoadingStateProps = {
  label?: string;
  compact?: boolean;
  dense?: boolean;
  embedded?: boolean;
  variant?: "cards" | "table" | "form" | "profile" | "analytics" | "agenda";
};

function inferVariant(): NonNullable<LoadingStateProps["variant"]> {
  const path = window.location.pathname.toLowerCase();
  if (path.includes("analise-dados") || path.includes("dashboard")) return "analytics";
  if (path.includes("/agenda")) return "agenda";
  if (path.includes("relatorios") || path.includes("profissionais")) return "table";
  if (path.includes("perfil")) return "profile";
  if (path.includes("funcionamento") || path.includes("register") || path.includes("assinatura")) return "form";
  return "cards";
}

function Bar({ width = "100%" }: { width?: string }) {
  return <span aria-hidden="true" className={styles.bar} style={{ width }} />;
}

export default function LoadingState({ label = "Carregando", compact = false, dense = false, embedded = false, variant }: LoadingStateProps) {
  const kind = variant ?? inferVariant();
  return (
    <div className={`${styles.loading} ${compact ? styles.compact : ""} ${dense ? styles.dense : ""} ${embedded ? styles.embedded : ""}`} role="status" aria-live="polite" aria-label={label} aria-busy="true">
      <span className={styles.srOnly}>{label}</span>
      {!compact && kind === "agenda" ? (
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
