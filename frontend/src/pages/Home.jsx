import Hero from "../components/Hero.jsx";
import Leadership from "../components/Leadership.jsx";
import Administration from "../components/Administration.jsx";
import Coordinators from "../components/Coordinators.jsx";
import MyRegistrationCard from "../components/MyRegistrationCard.jsx";
import { useSession } from "../lib/session.js";

export default function Home() {
  const { role, loading } = useSession();
  const isLoggedIn = !loading && role != null;

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
