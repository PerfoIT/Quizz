import { useEffect, useState } from "react";
import type { SessionSnapshot } from "./types";

export function useCountdown(snapshot: SessionSnapshot | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!snapshot?.questionStartedAt || !snapshot.currentQuestion || snapshot.status !== "QUESTION") {
      setRemaining(0);
      return;
    }

    const deadline =
      new Date(snapshot.questionStartedAt).getTime() + snapshot.currentQuestion.timeLimitSeconds * 1000;

    function tick() {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [snapshot]);

  return remaining;
}
