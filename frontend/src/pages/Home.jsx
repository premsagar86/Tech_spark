import { useEffect, useState } from "react";
import Hero from "../components/Hero.jsx";
import Leadership from "../components/Leadership.jsx";
import Administration from "../components/Administration.jsx";
import Coordinators from "../components/Coordinators.jsx";
import MyRegistrationCard from "../components/MyRegistrationCard.jsx";
import { getParticipantToken, getAdminToken } from "../lib/session.js";

export default function Home() {
  // Same-page login/logout doesn't trigger a route change, so re-check on the
  // shared session event instead of only at mount (see Hero.jsx).
  const [, setSessionTick] = useState(0);
  useEffect(() => {
    const handler = () => setSessionTick((n) => n + 1);
    window.addEventListener("ts2026-session-changed", handler);
    return () => window.removeEventListener("ts2026-session-changed", handler);
  }, []);

  const isLoggedIn = Boolean(getParticipantToken() || getAdminToken());

  return (
    <>
      <Hero />
      {!isLoggedIn && (
        <>
          <Leadership />
          <Administration />
        </>
      )}
      <MyRegistrationCard />
      <Coordinators />
    </>
  );
}
