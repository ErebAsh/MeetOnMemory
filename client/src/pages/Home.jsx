import React from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";
import HowItWorks from "../components/HowItWorks";

const Home = () => {
  return (
    <div className="relative min-h-screen bg-[url('/bg_img.png')] bg-cover bg-center flex flex-col">
      {/* Fixed Navbar */}
      <Navbar />

      {/* Main content (Header + Hero) */}
      <div className="flex flex-col items-center justify-center pt-32 pb-20 text-center">
        <Header />
      </div>

      {/* How It Works Section */}
      <HowItWorks />
    </div>
  );
};

export default Home;
