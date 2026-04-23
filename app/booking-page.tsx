"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { SlotWithBooking } from "@/lib/types";

type FormState = {
  customerName: string;
  customerWechatId: string;
};

const emptyBookingForm: FormState = {
  customerName: "",
  customerWechatId: "",
};

type BookingPageProps = {
  mode: "user" | "admin";
};

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

function getNextWeekBounds() {
  const now = new Date();
  const localDay = now.getDay();
  const daysSinceMonday = (localDay + 6) % 7;

  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - daysSinceMonday);
  currentWeekStart.setHours(0, 0, 0, 0);

  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);

  const weekAfterNextStart = new Date(nextWeekStart);
  weekAfterNextStart.setDate(nextWeekStart.getDate() + 7);

  return {
    nextWeekStart,
    weekAfterNextStart,
  };
}

function isInNextWeek(dateValue: string) {
  const date = new Date(dateValue);
  const { nextWeekStart, weekAfterNextStart } = getNextWeekBounds();
  return date >= nextWeekStart && date < weekAfterNextStart;
}

async function readApiResponse<T extends Record<string, unknown>>(
  response: Response,
  fallbackMessage: string,
): Promise<ApiResponse<T>> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    if (response.ok) {
      return { data: null, error: fallbackMessage };
    }

    return { data: null, error: fallbackMessage };
  }

  try {
    const data = (await response.json()) as T & { error?: string };

    if (!response.ok) {
      return { data: null, error: data.error ?? fallbackMessage };
    }

    return { data, error: null };
  } catch {
    return { data: null, error: fallbackMessage };
  }
}

export default function BookingPage({ mode }: BookingPageProps) {
  const [slots, setSlots] = useState<SlotWithBooking[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [bookingForm, setBookingForm] = useState<FormState>(emptyBookingForm);
  const [slotForm, setSlotForm] = useState({ startsAt: "", endsAt: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSlots() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/slots", { cache: "no-store" });
      const { data, error: responseError } = await readApiResponse<{
        slots?: SlotWithBooking[];
      }>(response, "Unable to load slots.");

      if (!data?.slots) {
        throw new Error(responseError ?? "Unable to load slots.");
      }

      setSlots(data.slots);

      if (
        selectedSlotId &&
        !data.slots.some(
          (slot) => slot.id === selectedSlotId && slot.bookingStatus === null,
        )
      ) {
        setSelectedSlotId(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load slots.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSlots();
  }, []);

  const nextWeekSlots = slots.filter((slot) => isInNextWeek(slot.startsAt));
  const availableSlots = nextWeekSlots.filter((slot) => slot.bookingStatus === null);
  const bookedSlots = nextWeekSlots.filter((slot) => slot.bookingStatus === "booked");
  const isUserPage = mode === "user";

  async function handleCreateSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/slots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(slotForm),
      });
      const { error: responseError } = await readApiResponse<{ slot?: SlotWithBooking }>(
        response,
        "Unable to create slot. Please try again.",
      );

      if (!response.ok) {
        throw new Error(responseError ?? "Unable to create slot. Please try again.");
      }

      setSlotForm({ startsAt: "", endsAt: "" });
      setMessage("New slot created.");
      await loadSlots();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create slot.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBookSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSlotId) {
      setError("Choose a slot before booking.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slotId: selectedSlotId,
          ...bookingForm,
        }),
      });
      const { error: responseError } = await readApiResponse(response, "Unable to book slot.");

      if (!response.ok) {
        throw new Error(responseError ?? "Unable to book slot.");
      }

      setBookingForm(emptyBookingForm);
      setSelectedSlotId(null);
      setMessage("Booking confirmed.");
      await loadSlots();
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Unable to book slot.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelBooking(bookingId: number) {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });
      const { error: responseError } = await readApiResponse(
        response,
        "Unable to cancel booking.",
      );

      if (!response.ok) {
        throw new Error(responseError ?? "Unable to cancel booking.");
      }

      setMessage("Booking cancelled.");
      await loadSlots();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel booking.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSlot(slotId: number) {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/slots?slotId=${slotId}`, {
        method: "DELETE",
      });
      const { error: responseError } = await readApiResponse(
        response,
        "Unable to delete slot.",
      );

      if (!response.ok) {
        throw new Error(responseError ?? "Unable to delete slot.");
      }

      setMessage("Slot deleted.");
      await loadSlots();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete slot.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeletePastSlots() {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/slots?action=cleanup", {
        method: "DELETE",
      });
      const { data, error: responseError } = await readApiResponse<{
        deletedCount?: number;
      }>(response, "Unable to delete past slots.");

      if (!response.ok) {
        throw new Error(responseError ?? "Unable to delete past slots.");
      }

      setMessage(`${data?.deletedCount ?? 0} past slot(s) deleted.`);
      await loadSlots();
    } catch (cleanupError) {
      setError(
        cleanupError instanceof Error ? cleanupError.message : "Unable to delete past slots.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Appointment Booking MVP</p>
          <h1>{isUserPage ? "Book or cancel a slot." : "Manage slots and bookings."}</h1>
        </div>
        <p className="hero-copy">
          {isUserPage
            ? "Pick an available time, book it with a name and WeChat ID, or cancel an existing booking when plans change."
            : "Create new time slots and keep an eye on the bookings that are already on the calendar."}
        </p>
      </section>

      {(message || error) && (
        <section className={error ? "notice error" : "notice success"}>
          {error ?? message}
        </section>
      )}

      <section className={isUserPage ? "single-layout" : "layout"}>
        {isUserPage ? (
          <>
            <div className="panel">
              <div className="panel-header">
                <h2>Available Slots</h2>
                <button className="ghost-button" type="button" onClick={() => void loadSlots()}>
                  Refresh
                </button>
              </div>

          {loading ? (
                <p className="muted-text">Loading slots...</p>
              ) : availableSlots.length === 0 ? (
                <p className="muted-text">No open slots for next week.</p>
              ) : (
                <div className="slot-list">
                  {availableSlots.map((slot) => (
                    <label
                      className={selectedSlotId === slot.id ? "slot-card selected" : "slot-card"}
                      key={slot.id}
                    >
                      <input
                        checked={selectedSlotId === slot.id}
                        name="selectedSlot"
                        onChange={() => setSelectedSlotId(slot.id)}
                        type="radio"
                        value={slot.id}
                      />
                      <span>{formatDateTime(slot.startsAt)}</span>
                      <span className="slot-meta">to {formatDateTime(slot.endsAt)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <form className="stack-form" onSubmit={handleBookSlot}>
                <h2>Book Selected Slot</h2>
                <label>
                  <span>Name</span>
                  <input
                    onChange={(event) =>
                      setBookingForm((current) => ({
                        ...current,
                        customerName: event.target.value,
                      }))
                    }
                    placeholder="Ada Lovelace"
                    required
                    value={bookingForm.customerName}
                  />
                </label>
                <label>
                  <span>WeChat ID</span>
                  <input
                    onChange={(event) =>
                      setBookingForm((current) => ({
                        ...current,
                        customerWechatId: event.target.value,
                      }))
                    }
                    placeholder="ada_wechat"
                    required
                    value={bookingForm.customerWechatId}
                  />
                </label>
                <button disabled={submitting || !selectedSlotId} type="submit">
                  {submitting ? "Saving..." : "Book slot"}
                </button>
              </form>

              <div className="panel-section admin-form">
                <h2>Your Booked Slots</h2>
                {loading ? (
                  <p className="muted-text">Loading bookings...</p>
                ) : bookedSlots.length === 0 ? (
                  <p className="muted-text">No next-week bookings yet.</p>
                ) : (
                  <div className="booking-list">
                    {bookedSlots.map((slot) => (
                      <article className="booking-card" key={slot.id}>
                        <div>
                          <strong>{formatDateTime(slot.startsAt)}</strong>
                          <p className="slot-meta">to {formatDateTime(slot.endsAt)}</p>
                        </div>
                        <p className="booking-meta">
                          {slot.customerName} · {slot.customerWechatId}
                        </p>
                        <button
                          className="secondary-button"
                          disabled={submitting || slot.bookingId === null}
                          onClick={() => {
                            if (slot.bookingId !== null) {
                              void handleCancelBooking(slot.bookingId);
                            }
                          }}
                          type="button"
                        >
                          Cancel booking
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="panel">
              <div className="panel-header">
                <h2>Next Week Slots</h2>
                <div className="button-row">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void handleDeletePastSlots()}
                  >
                    Delete past slots
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => void loadSlots()}
                  >
                    Refresh
                  </button>
                </div>
              </div>
              {loading ? (
                <p className="muted-text">Loading slots...</p>
              ) : nextWeekSlots.length === 0 ? (
                <p className="muted-text">No slots scheduled for next week.</p>
              ) : (
                <div className="booking-list">
                  {nextWeekSlots.map((slot) => (
                    <article className="booking-card" key={slot.id}>
                      <div>
                        <strong>{formatDateTime(slot.startsAt)}</strong>
                        <p className="slot-meta">to {formatDateTime(slot.endsAt)}</p>
                      </div>
                      <p className="booking-meta">
                        {slot.bookingStatus === "booked"
                          ? `${slot.customerName} · ${slot.customerWechatId}`
                          : "Available"}
                      </p>
                      <button
                        className="secondary-button"
                        disabled={submitting}
                        onClick={() => void handleDeleteSlot(slot.id)}
                        type="button"
                      >
                        Delete slot
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-section">
                <h2>Next Week Booked Slots</h2>
                {loading ? (
                  <p className="muted-text">Loading bookings...</p>
                ) : bookedSlots.length === 0 ? (
                  <p className="muted-text">No next-week bookings yet.</p>
                ) : (
                  <div className="booking-list">
                    {bookedSlots.map((slot) => (
                      <article className="booking-card" key={slot.id}>
                        <div>
                          <strong>{formatDateTime(slot.startsAt)}</strong>
                          <p className="slot-meta">to {formatDateTime(slot.endsAt)}</p>
                        </div>
                        <p className="booking-meta">
                          {slot.customerName} · {slot.customerWechatId}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <form className="stack-form" onSubmit={handleCreateSlot}>
                <h2>Create Slot</h2>
                <label>
                  <span>Start time</span>
                  <input
                    onChange={(event) =>
                      setSlotForm((current) => ({
                        ...current,
                        startsAt: event.target.value,
                      }))
                    }
                    required
                    type="datetime-local"
                    value={slotForm.startsAt}
                  />
                </label>
                <label>
                  <span>End time</span>
                  <input
                    onChange={(event) =>
                      setSlotForm((current) => ({
                        ...current,
                        endsAt: event.target.value,
                      }))
                    }
                    required
                    type="datetime-local"
                    value={slotForm.endsAt}
                  />
                </label>
                <button disabled={submitting} type="submit">
                  {submitting ? "Saving..." : "Create slot"}
                </button>
              </form>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
