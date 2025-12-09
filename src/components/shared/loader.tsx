"use client";

import { Rocket } from "lucide-react";
import { useEffect, useState } from "react";

const loadingTexts = [
    "Connecting to the grid...",
    "Calibrating trading bots...",
    "Engaging thrusters...",
    "Preparing for launch...",
    "Welcome to TradeVission",
];

export default function Loader() {
    const [currentText, setCurrentText] = useState(loadingTexts[0]);
    const [fade, setFade] = useState(true);

    useEffect(() => {
        let index = 0;
        const interval = setInterval(() => {
            setFade(false); // Start fade out
            setTimeout(() => {
                index = (index + 1) % loadingTexts.length;
                setCurrentText(loadingTexts[index]);
                setFade(true); // Start fade in
            }, 500);
        }, 2000);

        return () => clearInterval(interval);
    }, []);


  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm gap-6">
      <div className="rocket-container">
          <Rocket className="h-20 w-20 text-primary" />
      </div>
      <p 
        className={`text-lg font-medium text-muted-foreground transition-opacity duration-500 ${fade ? 'opacity-100' : 'opacity-0'}`}
      >
        {currentText}
      </p>

      <style jsx>{`
        .rocket-container {
            animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
            0% { transform: translateY(0px) rotate(-3deg); }
            50% { transform: translateY(-20px) rotate(3deg); }
            100% { transform: translateY(0px) rotate(-3deg); }
        }
      `}</style>
    </div>
  );
}
