import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Hero } from "../components/landing/Hero";
import { Intro } from "../components/landing/Intro";
import { Growth } from "../components/landing/Growth";
import { Gallery } from "../components/landing/Gallery";
import { CTA } from "../components/landing/CTA";
import "../styles/landing.css";

function Landing() {
  const { currentUser } = useAuth();
  const isLoggedIn = Boolean(currentUser);

  return (
    <main className="landing-page">
      <Hero />
      <Intro />
      <Growth />
      <Gallery />
      <CTA isLoggedIn={isLoggedIn} />
    </main>
  );
}

export default Landing;
