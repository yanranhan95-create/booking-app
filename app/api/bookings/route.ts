import Database from "better-sqlite3";
import { NextResponse } from "next/server";
import { createBooking } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    slotId?: number;
    customerName?: string;
    customerWechatId?: string;
  };

  const slotId = Number(body.slotId);
  const customerName = body.customerName?.trim();
  const customerWechatId = body.customerWechatId?.trim();

  if (!slotId || !customerName || !customerWechatId) {
    return NextResponse.json(
      { error: "Slot, name, and WeChat ID are required." },
      { status: 400 },
    );
  }

  try {
    const booking = createBooking(slotId, customerName, customerWechatId);

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_NOT_FOUND") {
      return NextResponse.json({ error: "That slot was not found." }, { status: 404 });
    }

    if (error instanceof Error && error.message === "WEEKLY_WECHAT_LIMIT") {
      return NextResponse.json(
        { error: "This WeChat ID already has a booking for this week." },
        { status: 409 },
      );
    }

    if (
      error instanceof Database.SqliteError &&
      error.code === "SQLITE_CONSTRAINT_UNIQUE"
    ) {
      return NextResponse.json(
        { error: "That slot has already been booked." },
        { status: 409 },
      );
    }

    throw error;
  }
}
