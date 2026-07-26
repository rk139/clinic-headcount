import type { SeriesDraft } from "@/lib/registration-types";
  
  type CreateSeriesFormProps = {
    draft: SeriesDraft;
    creating: boolean;
    onDraftChange: (
      field: keyof SeriesDraft,
      value: string | boolean,
    ) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  };
  
  export default function CreateSeriesForm({
    draft,
    creating,
    onDraftChange,
    onSubmit,
  }: CreateSeriesFormProps) {
    const styles = {
      panel: {
        border: "1px solid #2a2a33",
        borderRadius: 14,
        padding: 18,
        background: "#0f0f16",
        marginBottom: 18,
      } as React.CSSProperties,
  
      grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12,
      } as React.CSSProperties,
  
      field: {
        display: "grid",
        gap: 6,
        fontSize: 12,
        color: "#d4d4db",
      } as React.CSSProperties,
  
      input: {
        width: "100%",
        boxSizing: "border-box",
        background: "#0b0b0f",
        color: "#eaeaf0",
        border: "1px solid #2a2a33",
        borderRadius: 10,
        padding: "8px 10px",
        outline: "none",
      } as React.CSSProperties,
  
      checkboxLabel: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "#d4d4db",
        fontSize: 14,
        marginTop: 12,
      } as React.CSSProperties,
  
      primaryButton: {
        marginTop: 14,
        padding: "9px 14px",
        borderRadius: 10,
        border: "none",
        background: "#22c55e",
        color: "#0b0b0f",
        fontWeight: 800,
        cursor: creating ? "not-allowed" : "pointer",
        opacity: creating ? 0.6 : 1,
      } as React.CSSProperties,
    };
  
    return (
      <section style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>Create clinic series</h2>
  
        <form onSubmit={onSubmit}>
          <div style={styles.grid}>
            <label style={styles.field}>
              Series name
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  onDraftChange("name", event.target.value)
                }
                placeholder="Summer 2026 Juniors"
                required
                style={styles.input}
              />
            </label>
  
            <label style={styles.field}>
              Program
              <select
                value={draft.programType}
                onChange={(event) =>
                  onDraftChange("programType", event.target.value)
                }
                style={styles.input}
              >
                <option value="JUNIORS">Juniors</option>
                <option value="RED_BALL">Red Ball</option>
              </select>
            </label>
  
            <label style={styles.field}>
              Level
              <input
                type="text"
                value={draft.level}
                onChange={(event) =>
                  onDraftChange("level", event.target.value)
                }
                placeholder="Example: 3/4"
                style={styles.input}
              />
            </label>
  
            <label style={styles.field}>
              Start date
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  onDraftChange("startDate", event.target.value)
                }
                required
                style={styles.input}
              />
            </label>
  
            <label style={styles.field}>
              End date
              <input
                type="date"
                value={draft.endDate}
                onChange={(event) =>
                  onDraftChange("endDate", event.target.value)
                }
                required
                style={styles.input}
              />
            </label>
          </div>
  
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={draft.registrationOpen}
              onChange={(event) =>
                onDraftChange(
                  "registrationOpen",
                  event.target.checked,
                )
              }
            />
            Registration is open
          </label>
  
          <button
            type="submit"
            disabled={creating}
            style={styles.primaryButton}
          >
            {creating ? "Creating..." : "Create series"}
          </button>
        </form>
      </section>
    );
  }