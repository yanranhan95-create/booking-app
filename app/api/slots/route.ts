import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { createSlot, deletePastSlots, deleteSlot, listSlots } from "@/lib/db";
import { toIsoFromLocalDateTime } from "@/lib/format";

function isValidDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);

  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
}

export async function GET() {
  return NextResponse.json({ slots: listSlots() });
}

export async function POST(request: Request) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    startsAt?: string;
    endsAt?: string;
  };

  if (!body.startsAt || !body.endsAt) {
    return NextResponse.json(
      { error: "Start time and end time are required." },
      { status: 400 },
    );
  }

  const startsAt = toIsoFromLocalDateTime(body.startsAt);
  const endsAt = toIsoFromLocalDateTime(body.endsAt);

  if (!isValidDateRange(startsAt, endsAt)) {
    return NextResponse.json(
      { error: "End time must be after the start time." },
      { status: 400 },
    );
  }

  const slot = createSlot(startsAt, endsAt);

  return NextResponse.json({ slot }, { status: 201 });
}

export async function DELETE(request: Request) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "cleanup") {
    const deletedCount = deletePastSlots();
    return NextResponse.json({ deletedCount });
  }

  const slotId = Number(url.searchParams.get("slotId"));

  if (!slotId) {
    return NextResponse.json({ error: "Invalid slot id." }, { status: 400 });
  }

  const result = deleteSlot(slotId);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "That slot was not found." }, { status: 404 });
  }

  if (result.status === "has_booking") {
    return NextResponse.json(
      { error: "This slot already has a booking and cannot be deleted." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
