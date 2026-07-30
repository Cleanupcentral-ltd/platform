export function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function bookingDateBounds(now = new Date()) {
  const latest = new Date(now);
  latest.setDate(latest.getDate() + 90);
  return { min: localDateString(now), max: localDateString(latest) };
}

export function validateBookingDate(dateValue, arrivalWindow, now = new Date()) {
  if (!dateValue) return "Choose a preferred date.";
  const { min, max } = bookingDateBounds(now);
  if (dateValue < min) return "Past dates cannot be selected.";
  if (dateValue > max) return "Bookings can be requested no more than 90 days in advance.";
  if (dateValue === min) {
    if (!arrivalWindow) return "Choose a preferred arrival window.";
    const [hour, minute] = arrivalWindow.slice(0, 5).split(":").map(Number);
    const arrival = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
    if (arrival.getTime() - now.getTime() < 3 * 60 * 60 * 1000) return "Same-day requests require at least three hours’ notice before the arrival window begins.";
  }
  return "";
}
