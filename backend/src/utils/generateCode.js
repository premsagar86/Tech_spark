export function registrationCodeFromId(id) {
  return `TS2026-${String(id).padStart(6, "0")}`;
}

export function checkInCodeFor(registrationCode, participantOrder) {
  return `${registrationCode}-${String(participantOrder).padStart(2, "0")}`;
}
