"use client";

import { useEffect, useMemo, useState } from "react";

import CreateSeriesForm from "@/components/registrations/CreateSeriesForm";
import SeriesCard from "@/components/registrations/SeriesCard";
import SubmittedRegistrationsSection from "@/components/registrations/SubmittedRegistrationsSection";
import SummaryCards from "@/components/registrations/SummaryCards";

import type {
  ClinicSeries,
  SeriesDraft,
} from "@/lib/registration-types";

const emptyDraft: SeriesDraft = {
  name: "",
  programType: "JUNIORS",
  level: "",
  startDate: "",
  endDate: "",
  registrationOpen: false,
};

export default function RegistrationsBoard() {
  const [series, setSeries] = useState<ClinicSeries[]>([]);
  const [draft, setDraft] =
    useState<SeriesDraft>(emptyDraft);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<
    string | null
  >(null);

  const [editDraft, setEditDraft] =
    useState<SeriesDraft | null>(null);

  const [savingId, setSavingId] = useState<
    string | null
  >(null);

  const [deletingId, setDeletingId] = useState<
    string | null
  >(null);

  const loadSeries = async () => {
    setError("");

    try {
      const response = await fetch("/api/series", {
        cache: "no-store",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Failed to load series (${response.status})`,
        );
      }

      if (!Array.isArray(result)) {
        throw new Error("Unexpected series response.");
      }

      setSeries(result);
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load series.";

      setError(message);
      setSeries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSeries();
  }, []);

  const totalRegistrations = useMemo(
    () =>
      series.reduce(
        (total, item) =>
          total + item._count.registrations,
        0,
      ),
    [series],
  );

  const updateDraft = (
    field: keyof SeriesDraft,
    value: string | boolean,
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateEditDraft = (
    field: keyof SeriesDraft,
    value: string | boolean,
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

  const createSeries = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Failed to create series (${response.status})`,
        );
      }

      setDraft(emptyDraft);
      await loadSeries();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create series.",
      );
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (item: ClinicSeries) => {
    setEditingId(item.id);

    setEditDraft({
      name: item.name,
      programType: item.programType,
      level: item.level ?? "",
      startDate: item.startDate,
      endDate: item.endDate,
      registrationOpen: item.registrationOpen,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveSeries = async (id: string) => {
    if (!editDraft) {
      return;
    }

    setSavingId(id);
    setError("");

    try {
      const response = await fetch(
        `/api/series/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editDraft),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Failed to update series (${response.status})`,
        );
      }

      cancelEditing();
      await loadSeries();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update series.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const deleteSeries = async (
    item: ClinicSeries,
  ) => {
    const confirmed = window.confirm(
      `Delete "${item.name}"?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);
    setError("");

    try {
      const response = await fetch(
        `/api/series/${item.id}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Failed to delete series (${response.status})`,
        );
      }

      if (editingId === item.id) {
        cancelEditing();
      }

      await loadSeries();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to delete series.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const generateRegistrationLink = async (
    seriesId: string,
  ) => {
    setError("");

    try {
      const response = await fetch(
        `/api/series/${seriesId}/registration-link`,
        {
          method: "POST",
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Failed to generate registration link (${response.status})`,
        );
      }

      await loadSeries();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to generate registration link.",
      );
    }
  };

  const closeRegistrationLink = async (
    seriesId: string,
  ) => {
    const confirmed = window.confirm(
      "Close this registration link?",
    );

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      const response = await fetch(
        `/api/series/${seriesId}/registration-link`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Failed to close registration link (${response.status})`,
        );
      }

      await loadSeries();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to close registration link.",
      );
    }
  };

  const styles = {
    errorBox: {
      marginBottom: 16,
      color: "#fecaca",
      background: "#2a0f12",
      border: "1px solid #7f1d1d",
      padding: "10px 12px",
      borderRadius: 12,
    } as React.CSSProperties,

    panel: {
      border: "1px solid #2a2a33",
      borderRadius: 14,
      padding: 18,
      background: "#0f0f16",
      marginBottom: 18,
    } as React.CSSProperties,

    list: {
      display: "grid",
      gap: 12,
    } as React.CSSProperties,

    muted: {
      color: "#a1a1aa",
    } as React.CSSProperties,
  };

  return (
    <>
      <SummaryCards
        seriesCount={series.length}
        registrationCount={totalRegistrations}
      />

      {error ? (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <CreateSeriesForm
        draft={draft}
        creating={creating}
        onDraftChange={updateDraft}
        onSubmit={createSeries}
      />

      <section style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>
          Existing clinic series
        </h2>

        {loading ? (
          <p style={styles.muted}>Loading...</p>
        ) : series.length === 0 ? (
          <p style={styles.muted}>
            No clinic series have been created yet.
          </p>
        ) : (
          <div style={styles.list}>
            {series.map((item) => (
              <SeriesCard
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                editDraft={
                  editingId === item.id
                    ? editDraft
                    : null
                }
                saving={savingId === item.id}
                deleting={deletingId === item.id}
                onStartEditing={startEditing}
                onCancelEditing={cancelEditing}
                onEditDraftChange={updateEditDraft}
                onSave={saveSeries}
                onDelete={deleteSeries}
                onGenerateRegistrationLink={
                  generateRegistrationLink
                }
                onCloseRegistrationLink={
                  closeRegistrationLink
                }
              />
            ))}
          </div>
        )}
      </section>

      <SubmittedRegistrationsSection
        series={series}
      />
    </>
  );
}