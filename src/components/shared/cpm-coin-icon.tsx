
"use client";

import { cn } from "@/lib/utils";
import React from "react";

export function CpmCoinIcon({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {

  return (
    <div
      className={cn("coin-container", className)}
      {...props}
    >
      <div className="coin">
        <div className="side">
          <div className="inner-coin">
             <div className="coin-text-symbol">CPM</div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .coin-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 120px;
          height: 120px;
        }
        .coin {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            position: relative;
            transform-style: preserve-3d;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }

        .side {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            position: absolute;
            top: 0;
            left: 0;
            background: radial-gradient(circle at 50% 50%, #fff2a8, #d4af37, #b8860b);
            border: 4px solid #b8860b;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .side::before {
            content: '';
            position: absolute;
            top: 5%;
            left: 10%;
            width: 80%;
            height: 40%;
            background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%);
            border-radius: 50% / 100%;
            transform: rotate(45deg);
        }
        
        .inner-coin {
            width: 85%;
            height: 85%;
            border-radius: 50%;
            border: 2px solid rgba(139, 69, 19, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .coin-text-symbol {
          font-size: 26px;
          font-family: 'Times New Roman', serif;
          font-weight: bold;
          color: #4a2c00;
          text-shadow: 1px 1px 0px rgba(255,255,255,0.3);
        }
      `}</style>
    </div>
  );
}
