"use client";

import { useEffect, useMemo, useState } from "react";

import type { ClinicSeries } from "@/lib/registration-types";

type RegistrationStatus = "ACTIVE" | "CANCELLED";

type Registration = {
  id: string;
  childName: string;

  parentName: string;
  parentPhone: string;
  parentEmail: string | null;

  emergencyContactName: string | null;
  emergencyContactPhone: string | null;

  birthDate: string | null;
  medicalNotes: string | null;
  familyCode: string | null;

  qrToken: string;
  registrationMethod:
    | "PUBLIC_LINK"
    | "ADMIN"
    | "WALK_IN_CONVERSION";

  status: RegistrationStatus;

  createdAt: string;
  updatedAt: string;

  series: {
    id: string;
    name: string;
    programType: string;
    level: string | null;
    startDate: string;
    endDate: string;
  };

  _count: {
    attendanceConfirmations: number;
    checkIns: number;
  };
};

type RegistrationDraft = {
  childName: string;

  parentName: string;
  parentPhone: string;
  parentEmail: string;

  emergencyContactName: string;
  emergencyContactPhone: string;

  birthDate: string;
  medicalNotes: string;
  familyCode: string;
};

type Props = {
  series: ClinicSeries[];
};

function formatDate(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function registrationMethodLabel(
  method: Registration["registrationMethod"],
) {
  if (method === "PUBLIC_LINK") {
    return "Public link";
  }

  if (method === "WALK_IN_CONVERSION") {
    return "Walk-in conversion";
  }

  return "Admin";
}

function createDraft(
  registration: Registration,
): RegistrationDraft {
  return {
    childName: registration.childName,

    parentName: registration.parentName,
    parentPhone: registration.parentPhone,
    parentEmail: registration.parentEmail ?? "",

    emergencyContactName:
      registration.emergencyContactName ?? "",
    emergencyContactPhone:
      registration.emergencyContactPhone ?? "",

    birthDate: registration.birthDate ?? "",
    medicalNotes: registration.medicalNotes ?? "",
    familyCode: registration.familyCode ?? "",
  };
}

export default function SubmittedRegistrationsSection({
  series,
}: Props) {
  const [registrations, setRegistrations] = useState<
    Registration[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedSeriesId, setSelectedSeriesId] =
    useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<
    string | null
  >(null);

  const [editDraft, setEditDraft] =
    useState<RegistrationDraft | null>(null);

  const [savingId, setSavingId] = useState<
    string | null
  >(null);

  const [statusChangingId, setStatusChangingId] =
    useState<string | null>(null);

  const loadRegistrations = async (
    seriesId = selectedSeriesId,
    searchValue = search,
  ) => {
    setLoading(true);
    setError("");

    try {
      const searchParams = new URLSearchParams();

      if (seriesId) {
        searchParams.set("seriesId", seriesId);
      }

      if (searchValue.trim()) {
        searchParams.set("search", searchValue.trim());
      }

      const queryString = searchParams.toString();

      const response = await fetch(
        `/api/registrations${
          queryString ? `?${queryString}` : ""
        }`,
        {
          cache: "no-store",
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            `Failed to load registrations (${response.status})`,
        );
      }

      if (!Array.isArray(result.registrations)) {
        throw new Error(
          "Unexpected registrations response.",
        );
      }

      setRegistrations(result.registrations);
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load registrations.";

      setError(message);
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRegistrations(
      selectedSeriesId,
      search,
    );
  }, [selectedSeriesId, search]);

  const activeCount = useMemo(
    () =>
      registrations.filter(
        (registration) =>
          registration.status === "ACTIVE",
      ).length,
    [registrations],
  );

  const cancelledCount = useMemo(
    () =>
      registrations.filter(
        (registration) =>
          registration.status === "CANCELLED",
      ).length,
    [registrations],
  );

  const startEditing = (
    registration: Registration,
  ) => {
    setEditingId(registration.id);
    setEditDraft(createDraft(registration));
    setError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const updateEditDraft = (
    field: keyof RegistrationDraft,
    value: string,
  ) => {
    setEditDraft((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  };

  const saveRegistration = async (
    registrationId: string,
  ) => {
    if (!editDraft) {
      return;
    }

    setSavingId(registrationId);
    setError("");

    try {
      const response = await fetch(
        `/api/registrations/${registrationId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editDraft),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            `Failed to update registration (${response.status})`,
        );
      }

      cancelEditing();

      await loadRegistrations(
        selectedSeriesId,
        search,
      );
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update registration.";

      setError(message);
    } finally {
      setSavingId(null);
    }
  };

  const changeRegistrationStatus = async (
    registration: Registration,
  ) => {
    const nextStatus: RegistrationStatus =
      registration.status === "ACTIVE"
        ? "CANCELLED"
        : "ACTIVE";

    const action =
      nextStatus === "CANCELLED"
        ? "cancel"
        : "reactivate";

    const confirmed = window.confirm(
      `${action === "cancel" ? "Cancel" : "Reactivate"} registration for ${registration.childName}?`,
    );

    if (!confirmed) {
      return;
    }

    setStatusChangingId(registration.id);
    setError("");

    try {
      const response = await fetch(
        `/api/registrations/${registration.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            `Failed to ${action} registration (${response.status})`,
        );
      }

      if (editingId === registration.id) {
        cancelEditing();
      }

      await loadRegistrations(
        selectedSeriesId,
        search,
      );
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : `Failed to ${action} registration.`;

      setError(message);
    } finally {
      setStatusChangingId(null);
    }
  };

  const submitSearch = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setSelectedSeriesId("");
    setSearchInput("");
    setSearch("");
  };

  const exportRegistrations = () => {
    const searchParams = new URLSearchParams();

    if (selectedSeriesId) {
      searchParams.set(
        "seriesId",
        selectedSeriesId,
      );
    }

    if (search.trim()) {
      searchParams.set("search", search.trim());
    }

    const queryString = searchParams.toString();

    window.location.href =
      `/api/registrations/export${
        queryString ? `?${queryString}` : ""
      }`;
  };

  const copyQrToken = async (qrToken: string) => {
    try {
      await navigator.clipboard.writeText(qrToken);
    } catch {
      setError("The QR token could not be copied.");
    }
  };

  const styles = {
    panel: {
      border: "1px solid #2a2a33",
      borderRadius: 14,
      padding: 18,
      background: "#0f0f16",
      marginBottom: 18,
    } as React.CSSProperties,

    errorBox: {
      marginTop: 16,
      marginBottom: 16,
      color: "#fecaca",
      background: "#2a0f12",
      border: "1px solid #7f1d1d",
      padding: "10px 12px",
      borderRadius: 12,
    } as React.CSSProperties,

    field: {
      width: "100%",
      borderRadius: 10,
      border: "1px solid #34343d",
      background: "#15151d",
      color: "#eaeaf0",
      padding: "10px 12px",
      fontSize: 14,
      boxSizing: "border-box",
    } as React.CSSProperties,

    button: {
      borderRadius: 10,
      border: "1px solid #3f3f46",
      background: "#18181f",
      color: "#e4e4e7",
      padding: "10px 14px",
      cursor: "pointer",
      fontWeight: 700,
    } as React.CSSProperties,

    primaryButton: {
      borderRadius: 10,
      border: "1px solid #2563eb",
      background: "#2563eb",
      color: "#ffffff",
      padding: "10px 14px",
      cursor: "pointer",
      fontWeight: 800,
    } as React.CSSProperties,

    dangerButton: {
      borderRadius: 10,
      border: "1px solid #7f1d1d",
      background: "#291214",
      color: "#fecaca",
      padding: "10px 14px",
      cursor: "pointer",
      fontWeight: 700,
    } as React.CSSProperties,

    successButton: {
      borderRadius: 10,
      border: "1px solid #166534",
      background: "#10241a",
      color: "#bbf7d0",
      padding: "10px 14px",
      cursor: "pointer",
      fontWeight: 700,
    } as React.CSSProperties,

    card: {
      border: "1px solid #2a2a33",
      borderRadius: 14,
      padding: 16,
      background: "#14141b",
    } as React.CSSProperties,

    label: {
      color: "#71717a",
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      fontWeight: 700,
    } as React.CSSProperties,

    value: {
      color: "#e4e4e7",
      marginTop: 4,
      overflowWrap: "anywhere",
    } as React.CSSProperties,

    muted: {
      color: "#a1a1aa",
    } as React.CSSProperties,
  };

  return (
    <section style={styles.panel}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>
            Submitted registrations
          </h2>

          <p
            style={{
              ...styles.muted,
              marginTop: 0,
              marginBottom: 0,
            }}
          >
            Edit, cancel, reactivate, and export clinic
            registrations.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              void loadRegistrations(
                selectedSeriesId,
                search,
              )
            }
            style={styles.button}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={exportRegistrations}
            style={styles.primaryButton}
          >
            Export CSV
          </button>
        </div>
      </div>

      <form
        onSubmit={submitSearch}
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(180px, 1fr) minmax(220px, 2fr) auto auto",
          gap: 10,
          marginTop: 18,
        }}
      >
        <select
          value={selectedSeriesId}
          onChange={(event) =>
            setSelectedSeriesId(event.target.value)
          }
          style={styles.field}
        >
          <option value="">All clinic series</option>

          {series.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <input
          value={searchInput}
          onChange={(event) =>
            setSearchInput(event.target.value)
          }
          placeholder="Search child, parent, phone, email, or family code"
          style={styles.field}
        />

        <button type="submit" style={styles.button}>
          Search
        </button>

        <button
          type="button"
          onClick={clearFilters}
          style={styles.button}
        >
          Clear
        </button>
      </form>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        <span style={styles.muted}>
          Showing: {registrations.length}
        </span>

        <span style={{ color: "#bbf7d0" }}>
          Active: {activeCount}
        </span>

        <span style={{ color: "#fecaca" }}>
          Cancelled: {cancelledCount}
        </span>
      </div>

      {error ? (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {loading ? (
        <p style={styles.muted}>
          Loading registrations...
        </p>
      ) : registrations.length === 0 ? (
        <p style={styles.muted}>
          No registrations match the current filters.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {registrations.map((registration) => {
            const isEditing =
              editingId === registration.id;

            const isSaving =
              savingId === registration.id;

            const isChangingStatus =
              statusChangingId === registration.id;

            return (
              <article
                key={registration.id}
                style={styles.card}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        marginTop: 0,
                        marginBottom: 5,
                      }}
                    >
                      {registration.childName}
                    </h3>

                    <div style={styles.muted}>
                      {registration.series.name}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong
                      style={{
                        color:
                          registration.status === "ACTIVE"
                            ? "#bbf7d0"
                            : "#fecaca",
                      }}
                    >
                      {registration.status}
                    </strong>

                    <span style={styles.muted}>
                      {registrationMethodLabel(
                        registration.registrationMethod,
                      )}
                    </span>
                  </div>
                </div>

                {isEditing && editDraft ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(210px, 1fr))",
                      gap: 12,
                      marginTop: 18,
                    }}
                  >
                    <input
                      value={editDraft.childName}
                      onChange={(event) =>
                        updateEditDraft(
                          "childName",
                          event.target.value,
                        )
                      }
                      placeholder="Child name"
                      style={styles.field}
                    />

                    <input
                      type="date"
                      value={editDraft.birthDate}
                      onChange={(event) =>
                        updateEditDraft(
                          "birthDate",
                          event.target.value,
                        )
                      }
                      style={styles.field}
                    />

                    <input
                      value={editDraft.parentName}
                      onChange={(event) =>
                        updateEditDraft(
                          "parentName",
                          event.target.value,
                        )
                      }
                      placeholder="Parent name"
                      style={styles.field}
                    />

                    <input
                      value={editDraft.parentPhone}
                      onChange={(event) =>
                        updateEditDraft(
                          "parentPhone",
                          event.target.value,
                        )
                      }
                      placeholder="Parent phone"
                      style={styles.field}
                    />

                    <input
                      type="email"
                      value={editDraft.parentEmail}
                      onChange={(event) =>
                        updateEditDraft(
                          "parentEmail",
                          event.target.value,
                        )
                      }
                      placeholder="Parent email"
                      style={styles.field}
                    />

                    <input
                      value={
                        editDraft.emergencyContactName
                      }
                      onChange={(event) =>
                        updateEditDraft(
                          "emergencyContactName",
                          event.target.value,
                        )
                      }
                      placeholder="Emergency contact"
                      style={styles.field}
                    />

                    <input
                      value={
                        editDraft.emergencyContactPhone
                      }
                      onChange={(event) =>
                        updateEditDraft(
                          "emergencyContactPhone",
                          event.target.value,
                        )
                      }
                      placeholder="Emergency phone"
                      style={styles.field}
                    />

                    <input
                      value={editDraft.familyCode}
                      onChange={(event) =>
                        updateEditDraft(
                          "familyCode",
                          event.target.value,
                        )
                      }
                      placeholder="Family code"
                      style={styles.field}
                    />

                    <textarea
                      value={editDraft.medicalNotes}
                      onChange={(event) =>
                        updateEditDraft(
                          "medicalNotes",
                          event.target.value,
                        )
                      }
                      placeholder="Medical notes"
                      rows={3}
                      style={{
                        ...styles.field,
                        gridColumn: "1 / -1",
                        resize: "vertical",
                      }}
                    />

                    <div
                      style={{
                        gridColumn: "1 / -1",
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() =>
                          void saveRegistration(
                            registration.id,
                          )
                        }
                        style={styles.primaryButton}
                      >
                        {isSaving
                          ? "Saving..."
                          : "Save changes"}
                      </button>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={cancelEditing}
                        style={styles.button}
                      >
                        Cancel edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 14,
                        marginTop: 18,
                      }}
                    >
                      <div>
                        <div style={styles.label}>
                          Parent
                        </div>
                        <div style={styles.value}>
                          {registration.parentName}
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Parent phone
                        </div>
                        <div style={styles.value}>
                          {registration.parentPhone}
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Parent email
                        </div>
                        <div style={styles.value}>
                          {registration.parentEmail || "—"}
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Birth date
                        </div>
                        <div style={styles.value}>
                          {registration.birthDate || "—"}
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Emergency contact
                        </div>
                        <div style={styles.value}>
                          {registration.emergencyContactName ||
                            "—"}
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Emergency phone
                        </div>
                        <div style={styles.value}>
                          {registration.emergencyContactPhone ||
                            "—"}
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Family code
                        </div>
                        <div style={styles.value}>
                          {registration.familyCode || "—"}
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Registered
                        </div>
                        <div style={styles.value}>
                          {formatDate(
                            registration.createdAt,
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Attendance dates
                        </div>
                        <div style={styles.value}>
                          {
                            registration._count
                              .attendanceConfirmations
                          }
                        </div>
                      </div>

                      <div>
                        <div style={styles.label}>
                          Check-ins
                        </div>
                        <div style={styles.value}>
                          {registration._count.checkIns}
                        </div>
                      </div>
                    </div>

                    {registration.medicalNotes ? (
                      <div
                        style={{
                          marginTop: 16,
                          border: "1px solid #3f3f46",
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <div style={styles.label}>
                          Medical notes
                        </div>

                        <div
                          style={{
                            ...styles.value,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {registration.medicalNotes}
                        </div>
                      </div>
                    ) : null}

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop:
                          "1px solid #292932",
                      }}
                    >
                      <div>
                        <div style={styles.label}>
                          QR token
                        </div>

                        <div
                          style={{
                            ...styles.value,
                            fontFamily: "monospace",
                            fontSize: 13,
                          }}
                        >
                          {registration.qrToken}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            void copyQrToken(
                              registration.qrToken,
                            )
                          }
                          style={styles.button}
                        >
                          Copy QR token
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            startEditing(registration)
                          }
                          style={styles.button}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={isChangingStatus}
                          onClick={() =>
                            void changeRegistrationStatus(
                              registration,
                            )
                          }
                          style={
                            registration.status === "ACTIVE"
                              ? styles.dangerButton
                              : styles.successButton
                          }
                        >
                          {isChangingStatus
                            ? "Updating..."
                            : registration.status ===
                                "ACTIVE"
                              ? "Cancel registration"
                              : "Reactivate"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}