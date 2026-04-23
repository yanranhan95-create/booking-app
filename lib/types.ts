export type Slot = {
  id: number;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

export type BookingStatus = "booked" | "cancelled";

export type Booking = {
  id: number;
  slotId: number;
  customerName: string;
  customerWechatId: string;
  status: BookingStatus;
  createdAt: string;
  cancelledAt: string | null;
};

export type SlotWithBooking = Slot & {
  bookingId: number | null;
  bookingStatus: BookingStatus | null;
  customerName: string | null;
  customerWechatId: string | null;
};
