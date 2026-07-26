type SummaryCardsProps = {
    seriesCount: number;
    registrationCount: number;
  };
  
  export default function SummaryCards({
    seriesCount,
    registrationCount,
  }: SummaryCardsProps) {
    const styles = {
      grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
        marginBottom: 18,
      } as React.CSSProperties,
  
      card: {
        border: "1px solid #2a2a33",
        borderRadius: 14,
        padding: 16,
        background: "#0f0f16",
      } as React.CSSProperties,
  
      label: {
        fontSize: 12,
        color: "#a1a1aa",
        marginBottom: 6,
      } as React.CSSProperties,
  
      value: {
        fontSize: 28,
        fontWeight: 800,
      } as React.CSSProperties,
    };
  
    return (
      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.label}>Clinic series</div>
          <div style={styles.value}>{seriesCount}</div>
        </div>
  
        <div style={styles.card}>
          <div style={styles.label}>Total registrations</div>
          <div style={styles.value}>{registrationCount}</div>
        </div>
      </div>
    );
  }