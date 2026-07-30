export function determineRealtimeArenaOutcome({ currentHp, participants, round, maxRounds, timeoutStreaks, timeoutLossCount }) {
  const hostKo = currentHp.host <= 0;
  const guestKo = currentHp.guest <= 0;
  if (hostKo && guestKo) return { outcome: "draw", reason: "simultaneous_ko" };
  if (hostKo) return { outcome: "guest_win", reason: "ko" };
  if (guestKo) return { outcome: "host_win", reason: "ko" };
  const hostTimedOut = timeoutStreaks.host >= timeoutLossCount;
  const guestTimedOut = timeoutStreaks.guest >= timeoutLossCount;
  if (hostTimedOut && guestTimedOut) return { outcome: "draw", reason: "double_timeout" };
  if (hostTimedOut) return { outcome: "guest_win", reason: "timeout" };
  if (guestTimedOut) return { outcome: "host_win", reason: "timeout" };
  if (round < maxRounds) return null;
  const hostRatioCross = currentHp.host * participants.guest.maxHp;
  const guestRatioCross = currentHp.guest * participants.host.maxHp;
  if (hostRatioCross === guestRatioCross) return { outcome: "draw", reason: "max_round" };
  return { outcome: hostRatioCross > guestRatioCross ? "host_win" : "guest_win", reason: "max_round" };
}
