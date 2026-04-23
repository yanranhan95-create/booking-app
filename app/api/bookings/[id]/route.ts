import { NextResponse } from "next/server";
import { cancelBooking } from "@/lib/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const bookingId = Number(params.id);

  if (!bookingId) {
    return NextResponse.json({ error: "Invalid booking id." }, { status: 400 });
  }

  const booking = cancelBooking(bookingId);

  if (!booking) {
    return NextResponse.json(
      { error: "Active booking not found for that id." },
      { status: 404 },
    );
  }

  return NextResponse.json({ booking });
}
