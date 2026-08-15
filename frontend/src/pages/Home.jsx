import Hero from "../components/Hero.jsx";
import Leadership from "../components/Leadership.jsx";
import Administration from "../components/Administration.jsx";
import Coordinators from "../components/Coordinators.jsx";
import MyRegistrationCard from "../components/MyRegistrationCard.jsx";

export default function Home() {
  return (
    <>
      <Hero />
      <MyRegistrationCard />
      <Leadership />
      <Administration />
      <Coordinators />
    </>
  );
}
