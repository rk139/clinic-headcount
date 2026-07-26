"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type SeriesInfo = {
  id: string;
  name: string;
  programType: string;
  programLabel: string;
  level: string | null;
  startDate: string;
  endDate: string;
  startDateLabel: string;
  endDateLabel: string;
  locationLabel: string;
};

type ChildForm = {
  childName: string;
  birthDate: string;
  medicalNotes: string;
};

function createEmptyChild(): ChildForm {
  return {
    childName: "",
    birthDate: "",
    medicalNotes: "",
  };
}

export default function RegistrationPage() {
  const params = useParams();
  const token = params.token as string;

  const [series, setSeries] = useState<SeriesInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  const [emergencyContactName, setEmergencyContactName] =
    useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] =
    useState("");

  const [familyCode, setFamilyCode] = useState("");

  const [children, setChildren] = useState<ChildForm[]>([
    createEmptyChild(),
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadRegistrationLink = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const response = await fetch(`/api/r/${token}`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          setSeries(null);
          setLoadError(
            data?.error ??
              "Invalid or expired registration link.",
          );
          return;
        }

        setSeries(data.series ?? null);
      } catch {
        setSeries(null);
        setLoadError(
          "Something went wrong loading this registration link.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadRegistrationLink();
  }, [token]);

  function updateChild(
    index: number,
    field: keyof ChildForm,
    value: string,
  ) {
    setChildren((currentChildren) =>
      currentChildren.map((child, childIndex) =>
        childIndex === index
          ? {
              ...child,
              [field]: value,
            }
          : child,
      ),
    );
  }

  function addChild() {
    setChildren((currentChildren) => [
      ...currentChildren,
      createEmptyChild(),
    ]);
  }

  function removeChild(index: number) {
    setChildren((currentChildren) => {
      const nextChildren = currentChildren.filter(
        (_, childIndex) => childIndex !== index,
      );

      return nextChildren.length > 0
        ? nextChildren
        : [createEmptyChild()];
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    const cleanedParentName = parentName.trim();
    const cleanedParentPhone = parentPhone.trim();

    const cleanedChildren = children
      .map((child) => ({
        childName: child.childName.trim(),
        birthDate: child.birthDate.trim(),
        medicalNotes: child.medicalNotes.trim(),
      }))
      .filter((child) => child.childName.length > 0);

    if (!cleanedParentName) {
      setFormError("Parent or guardian name is required.");
      return;
    }

    if (!cleanedParentPhone) {
      setFormError("Parent or guardian phone number is required.");
      return;
    }

    if (cleanedChildren.length === 0) {
      setFormError("Please enter at least one child.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/r/${token}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentName: cleanedParentName,
          parentPhone: cleanedParentPhone,
          parentEmail: parentEmail.trim(),
          emergencyContactName: emergencyContactName.trim(),
          emergencyContactPhone: emergencyContactPhone.trim(),
          familyCode: familyCode.trim().toUpperCase(),
          children: cleanedChildren,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setFormError(
          data?.error ??
            "Registration could not be submitted.",
        );
        return;
      }

      setSuccessMessage(
        data?.message ??
          "Registration submitted successfully.",
      );
    } catch {
      setFormError(
        "A network error occurred. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6f8", color: "#172033" }}>
      <header
        style={{
          background: "#ffffff",
          borderBottom: "4px solid #f59e0b",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "22px 24px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#172554",
              color: "#ffffff",
              border: "4px solid #f59e0b",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              fontSize: 20,
            }}
          >
            S
          </div>

          <div>
            <div
              style={{
                color: "#172554",
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "-0.02em",
              }}
            >
              SPRINGSIDE ATHLETIC CLUB
            </div>
            <div
              style={{
                color: "#f59e0b",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginTop: 3,
              }}
            >
              Junior Tennis
            </div>
          </div>
        </div>
      </header>

      <section
        style={{
          background: "#172554",
          color: "#ffffff",
          textAlign: "center",
          padding: "42px 20px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(30px, 5vw, 42px)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
          }}
        >
          Clinic Registration
        </h1>
        <p
          style={{
            margin: "10px auto 0",
            maxWidth: 560,
            color: "#dbeafe",
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          Reserve your child&apos;s place in the clinic series.
        </p>
      </section>

      <main
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "34px 18px 48px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dbe1ea",
            borderRadius: 20,
            boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "clamp(22px, 5vw, 40px)" }}>
            {loading ? (
              <div style={{ padding: "60px 0", textAlign: "center", color: "#475569" }}>
                Loading clinic registration…
              </div>
            ) : loadError ? (
              <MessageBox color="#b91c1c" background="#fef2f2" border="#fecaca">
                {loadError}
              </MessageBox>
            ) : series ? (
              <>
                <section
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderLeft: "6px solid #f59e0b",
                    borderRadius: 16,
                    padding: "24px",
                  }}
                >
                  <div
                    style={{
                      color: "#d97706",
                      fontSize: 12,
                      fontWeight: 900,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    Clinic series
                  </div>

                  <h2
                    style={{
                      margin: "8px 0 0",
                      color: "#172554",
                      fontSize: "clamp(26px, 4vw, 34px)",
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {series.name}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 14,
                    }}
                  >
                    <span
                      style={{
                        background: "#172554",
                        color: "#ffffff",
                        borderRadius: 999,
                        padding: "8px 13px",
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {series.programLabel}
                    </span>

                    {series.level ? (
                      <span
                        style={{
                          background: "#f59e0b",
                          color: "#172554",
                          borderRadius: 999,
                          padding: "8px 13px",
                          fontSize: 13,
                          fontWeight: 900,
                        }}
                      >
                        Level {series.level}
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: 12,
                      marginTop: 20,
                    }}
                  >
                    <InfoBox label="Starts" value={series.startDateLabel} />
                    <InfoBox label="Ends" value={series.endDateLabel} />
                    <InfoBox label="Location" value={series.locationLabel} />
                  </div>
                </section>

                <form onSubmit={handleSubmit} style={{ marginTop: 34 }}>
                  <FormSection title="Parent or guardian" subtitle="Primary contact information">
                    <div style={gridStyle}>
                      <Field label="Name *">
                        <input
                          value={parentName}
                          onChange={(event) => setParentName(event.target.value)}
                          style={inputStyle}
                          placeholder="Parent or guardian name"
                        />
                      </Field>

                      <Field label="Phone *">
                        <input
                          value={parentPhone}
                          onChange={(event) => setParentPhone(event.target.value)}
                          inputMode="tel"
                          style={inputStyle}
                          placeholder="Phone number"
                        />
                      </Field>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <Field label="Email">
                          <input
                            value={parentEmail}
                            onChange={(event) => setParentEmail(event.target.value)}
                            type="email"
                            style={inputStyle}
                            placeholder="Email address"
                          />
                        </Field>
                      </div>
                    </div>
                  </FormSection>

                  <FormSection title="Emergency contact" subtitle="Someone we can contact if needed">
                    <div style={gridStyle}>
                      <Field label="Name">
                        <input
                          value={emergencyContactName}
                          onChange={(event) => setEmergencyContactName(event.target.value)}
                          style={inputStyle}
                          placeholder="Emergency contact name"
                        />
                      </Field>

                      <Field label="Phone">
                        <input
                          value={emergencyContactPhone}
                          onChange={(event) => setEmergencyContactPhone(event.target.value)}
                          inputMode="tel"
                          style={inputStyle}
                          placeholder="Emergency contact phone"
                        />
                      </Field>
                    </div>
                  </FormSection>

                  <section style={{ marginTop: 34 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "end",
                        gap: 16,
                        flexWrap: "wrap",
                        borderBottom: "1px solid #e2e8f0",
                        paddingBottom: 12,
                        marginBottom: 18,
                      }}
                    >
                      <div>
                        <h3 style={sectionTitleStyle}>Children</h3>
                        <p style={sectionSubtitleStyle}>Add each child attending the series</p>
                      </div>

                      <button
                        type="button"
                        onClick={addChild}
                        style={{
                          border: "2px solid #172554",
                          background: "#ffffff",
                          color: "#172554",
                          borderRadius: 999,
                          padding: "9px 15px",
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        + ADD CHILD
                      </button>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                      {children.map((child, index) => (
                        <div
                          key={index}
                          style={{
                            border: "1px solid #dbe1ea",
                            borderRadius: 15,
                            overflow: "hidden",
                            background: "#f8fafc",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "13px 18px",
                              background: "#eff6ff",
                              borderBottom: "1px solid #dbe1ea",
                            }}
                          >
                            <strong style={{ color: "#172554" }}>Child {index + 1}</strong>

                            {children.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeChild(index)}
                                style={{
                                  border: 0,
                                  background: "transparent",
                                  color: "#b91c1c",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>

                          <div style={{ ...gridStyle, padding: 18 }}>
                            <Field label="Child name *">
                              <input
                                value={child.childName}
                                onChange={(event) =>
                                  updateChild(index, "childName", event.target.value)
                                }
                                style={inputStyle}
                                placeholder="Child name"
                              />
                            </Field>

                            <Field label="Birth date">
                              <input
                                value={child.birthDate}
                                onChange={(event) =>
                                  updateChild(index, "birthDate", event.target.value)
                                }
                                type="date"
                                style={inputStyle}
                              />
                            </Field>

                            <div style={{ gridColumn: "1 / -1" }}>
                              <Field label="Medical notes">
                                <textarea
                                  value={child.medicalNotes}
                                  onChange={(event) =>
                                    updateChild(index, "medicalNotes", event.target.value)
                                  }
                                  rows={3}
                                  style={{
                                    ...inputStyle,
                                    resize: "vertical",
                                    paddingLeft: "16px",
                                    paddingRight: "16px",
                                  }}
                                  placeholder="Allergies, medical conditions, or other important notes"
                                />
                              </Field>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <FormSection title="Family code" subtitle="Optional">
                    <Field label="Family code">
                      <input
                        value={familyCode}
                        onChange={(event) =>
                          setFamilyCode(event.target.value.toUpperCase())
                        }
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        style={{ ...inputStyle, textTransform: "uppercase" }}
                        placeholder="Optional"
                      />
                    </Field>
                    <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 12 }}>
                      Use this code to group siblings or connect this registration with an existing family.
                    </p>
                  </FormSection>

                  {formError ? (
                    <MessageBox color="#b91c1c" background="#fef2f2" border="#fecaca">
                      {formError}
                    </MessageBox>
                  ) : null}

                  {successMessage ? (
                    <MessageBox color="#047857" background="#ecfdf5" border="#a7f3d0">
                      {successMessage}
                    </MessageBox>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      width: "100%",
                      border: 0,
                      borderRadius: 12,
                      background: submitting ? "#94a3b8" : "#f59e0b",
                      color: "#172554",
                      padding: "16px 20px",
                      fontSize: 14,
                      fontWeight: 900,
                      letterSpacing: "0.06em",
                      cursor: submitting ? "not-allowed" : "pointer",
                      marginTop: 26,
                    }}
                  >
                    {submitting ? "Submitting registration…" : "SUBMIT REGISTRATION"}
                  </button>
                </form>
              </>
            ) : (
              <MessageBox color="#b91c1c" background="#fef2f2" border="#fecaca">
                Unable to load this registration.
              </MessageBox>
            )}
          </div>

          <footer
            style={{
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              padding: "16px",
              textAlign: "center",
              color: "#64748b",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Springside Athletic Club · Akron, Ohio
          </footer>
        </div>
      </main>
    </div>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  marginTop: 7,
  border: "1px solid #cbd5e1",
  borderRadius: 11,
  background: "#ffffff",
  color: "#0f172a",
  padding: "13px 14px",
  fontSize: 14,
  outline: "none",
};

const sectionTitleStyle = {
  margin: 0,
  color: "#172554",
  fontSize: 22,
  fontWeight: 900,
};

const sectionSubtitleStyle = {
  margin: "4px 0 0",
  color: "#64748b",
  fontSize: 14,
};

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 34 }}>
      <div
        style={{
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: 12,
          marginBottom: 18,
        }}
      >
        <h3 style={sectionTitleStyle}>{title}</h3>
        <p style={sectionSubtitleStyle}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ color: "#334155", fontSize: 14, fontWeight: 800 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dbeafe",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ color: "#172554", fontSize: 14, fontWeight: 900, marginTop: 5 }}>
        {value}
      </div>
    </div>
  );
}

function MessageBox({
  children,
  color,
  background,
  border,
}: {
  children: React.ReactNode;
  color: string;
  background: string;
  border: string;
}) {
  return (
    <div
      style={{
        marginTop: 18,
        border: `1px solid ${border}`,
        background,
        color,
        borderRadius: 12,
        padding: "14px 16px",
        textAlign: "center",
        fontSize: 14,
        fontWeight: 800,
      }}
    >
      {children}
    </div>
  );
}

