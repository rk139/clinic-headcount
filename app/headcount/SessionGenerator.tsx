"use client";

import { useState } from "react";

type SessionGeneratorProps = {
  onSuccess: () => void | Promise<void>;
};

type SeedResponse = {
  ok: boolean;
  createdSessions?: number;
  skippedSessions?: number;
  createdLinks?: number;
  error?: string;
};

const weekdayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function toLocalYMD(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultEndDate() {
  const date = new Date();

  date.setDate(date.getDate() + 28);

  return toLocalYMD(date);
}

export default function SessionGenerator({
  onSuccess,
}: SessionGeneratorProps) {
  const [startDate, setStartDate] = useState(toLocalYMD(new Date()));
  const [endDate, setEndDate] = useState(getDefaultEndDate());

  const [weekdays, setWeekdays] = useState<number[]>([
    1,
    2,
    3,
    4,
    5,
  ]);

  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("11:30");

  const [programType, setProgramType] = useState("JUNIORS");
  const [level, setLevel] = useState("3/4");
  const [capacity, setCapacity] = useState("16");
  const [createLinks, setCreateLinks] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const toggleWeekday = (weekday: number) => {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : [...current, weekday],
    );
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setMessage("");
    setError("");

    const parsedCapacity = Number(capacity);

    if (!startDate || !endDate) {
      setError("Choose both a start date and an end date.");
      return;
    }

    if (endDate < startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }

    if (weekdays.length === 0) {
      setError("Select at least one day of the week.");
      return;
    }

    if (!startTime || !endTime) {
      setError("Choose both a start time and an end time.");
      return;
    }

    if (endTime <= startTime) {
      setError("The end time must be after the start time.");
      return;
    }

    if (
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity < 1
    ) {
      setError("Capacity must be a whole number greater than zero.");
      return;
    }

    if (programType === "JUNIORS" && !level.trim()) {
      setError("Enter a level for the junior clinic.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/seed-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          weekdays,
          startTime,
          endTime,
          programType,
          level:
            programType === "RED_BALL"
              ? null
              : level.trim(),
          capacity: parsedCapacity,
          createLinks,
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | SeedResponse
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            `Session generation failed (${response.status}).`,
        );
      }

      const created = result.createdSessions ?? 0;
      const skipped = result.skippedSessions ?? 0;
      const links = result.createdLinks ?? 0;

      setMessage(
        `Created ${created} session${created === 1 ? "" : "s"}. ` +
          `Skipped ${skipped} existing session${
            skipped === 1 ? "" : "s"
          }. ` +
          `Created ${links} response link${
            links === 1 ? "" : "s"
          }.`,
      );

      await onSuccess();
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to generate sessions.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginTop: 6,
    padding: "9px 10px",
    borderRadius: 10,
    border: "1px solid #2a2a33",
    background: "#0b0b0f",
    color: "#eaeaf0",
    outline: "none",
    boxSizing: "border-box",
  };

  const fieldStyle: React.CSSProperties = {
    minWidth: 150,
    flex: "1 1 170px",
  };

  return (
    <section
      style={{
        marginBottom: 22,
        padding: 16,
        border: "1px solid #2a2a33",
        borderRadius: 14,
        background: "#0f0f16",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 21 }}>
          Session Generator
        </h2>

        <p
          style={{
            margin: "6px 0 0",
            color: "#a1a1aa",
            fontSize: 14,
          }}
        >
          Create all matching clinic sessions within a date range.
        </p>
      </div>

      <form onSubmit={submit}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <label style={fieldStyle}>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
              style={inputStyle}
              required
            />
          </label>

          <label style={fieldStyle}>
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
              min={startDate}
              style={inputStyle}
              required
            />
          </label>

          <label style={fieldStyle}>
            Start time
            <input
              type="time"
              value={startTime}
              onChange={(event) =>
                setStartTime(event.target.value)
              }
              style={inputStyle}
              required
            />
          </label>

          <label style={fieldStyle}>
            End time
            <input
              type="time"
              value={endTime}
              onChange={(event) =>
                setEndTime(event.target.value)
              }
              style={inputStyle}
              required
            />
          </label>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            Days of the week
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {weekdayOptions.map((day) => {
              const selected = weekdays.includes(day.value);

              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleWeekday(day.value)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 10,
                    border: selected
                      ? "1px solid #4ade80"
                      : "1px solid #2a2a33",
                    background: selected
                      ? "#16351f"
                      : "#0b0b0f",
                    color: selected
                      ? "#86efac"
                      : "#d4d4db",
                    cursor: "pointer",
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 16,
          }}
        >
          <label style={fieldStyle}>
            Program
            <select
              value={programType}
              onChange={(event) =>
                setProgramType(event.target.value)
              }
              style={inputStyle}
            >
              <option value="JUNIORS">Juniors</option>
              <option value="RED_BALL">Red Ball</option>
            </select>
          </label>

          <label style={fieldStyle}>
            Level
            <input
              type="text"
              value={programType === "RED_BALL" ? "" : level}
              onChange={(event) => setLevel(event.target.value)}
              placeholder="Example: 3/4"
              disabled={programType === "RED_BALL"}
              style={{
                ...inputStyle,
                opacity:
                  programType === "RED_BALL" ? 0.55 : 1,
              }}
            />
          </label>

          <label style={fieldStyle}>
            Capacity
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={capacity}
              onChange={(event) =>
                setCapacity(event.target.value)
              }
              style={inputStyle}
              required
            />
          </label>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
            color: "#d4d4db",
          }}
        >
          <input
            type="checkbox"
            checked={createLinks}
            onChange={(event) =>
              setCreateLinks(event.target.checked)
            }
          />

          Automatically create response links
        </label>

        {error ? (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #7f1d1d",
              background: "#2a0f12",
              color: "#fecaca",
            }}
          >
            {error}
          </div>
        ) : null}

        {message ? (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #166534",
              background: "#0f2c19",
              color: "#bbf7d0",
            }}
          >
            {message}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 16,
          }}
        >
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "9px 16px",
              borderRadius: 11,
              border: "none",
              background: submitting
                ? "#2a2a33"
                : "#22c55e",
              color: submitting
                ? "#b7b7c3"
                : "#0b0b0f",
              fontWeight: 700,
              cursor: submitting
                ? "not-allowed"
                : "pointer",
            }}
          >
            {submitting
              ? "Generating..."
              : "Generate Sessions"}
          </button>
        </div>
      </form>
    </section>
  );
}