
"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SpinWheelProps {
    segments: string[];
    finalAngle: number;
    isSpinning: boolean;
}

export function SpinWheel({ segments, finalAngle, isSpinning }: SpinWheelProps) {
  const numSegments = segments.length;
  const anglePerSegment = 360 / numSegments;

  const segmentColors = [
    'hsl(var(--primary))',
    'hsl(var(--secondary))',
    'hsl(var(--destructive))',
    'hsl(var(--accent))',
    'hsl(var(--primary) / 0.7)',
    'hsl(var(--secondary) / 0.8)',
    'hsl(var(--destructive) / 0.7)',
    'hsl(var(--accent) / 0.8)',
  ];

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center wheel-perspective">
      <div
        className="wheel-container"
        style={{
          transform: `rotate(${finalAngle}deg)`,
          transition: isSpinning ? 'transform 4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
        }}
      >
        <div className="wheel">
          {segments.map((segment, index) => {
            const rotation = index * anglePerSegment;
            const skewY = 90 - anglePerSegment;
            
            const bgColor = segmentColors[index % segmentColors.length];

            return (
              <div
                key={index}
                className="segment"
                style={{
                  transform: `rotate(${rotation}deg) skewY(-${skewY}deg)`,
                  background: `radial-gradient(circle at 100% 100%, hsl(var(--background)/0.3), ${bgColor})`,
                }}
              >
                <div 
                    className="segment-content" 
                    style={{ 
                        transform: `skewY(${skewY}deg) rotate(${anglePerSegment / 2}deg)` 
                    }}
                >
                  <span className="text-xs sm:text-sm font-bold text-primary-foreground tracking-tight">{segment}</span>
                </div>
              </div>
            );
          })}

          {segments.map((_, index) => (
             <div 
                key={`pin-${index}`} 
                className="pin" 
                style={{
                    transform: `rotate(${index * anglePerSegment + (anglePerSegment/2)}deg) translate(115px) sm:translate(145px)`,
                }}
             />
          ))}

           <div className="wheel-center">
              <div className="wheel-center-inner"></div>
           </div>
        </div>
      </div>
      <div className="pointer-container">
        <div className="pointer"></div>
      </div>

      <style jsx>{`
        .wheel-perspective {
            perspective: 1000px;
        }
        .wheel-container {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          transform-style: preserve-3d;
          transform: rotateX(10deg);
        }
        .wheel {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          position: relative;
          overflow: hidden;
          border: 12px solid hsl(var(--muted));
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), inset 0 0 25px rgba(0,0,0,0.7);
          background: radial-gradient(circle at center, hsl(var(--background)) 50%, hsl(var(--muted)) 100%);
        }
        .segment {
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 50%;
          transform-origin: 100% 100%;
          overflow: hidden;
          border: 1px solid hsl(var(--border) / 0.1);
          opacity: 0.9;
        }
        .segment-content {
          position: absolute;
          left: -100%;
          width: 200%;
          height: 200%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-right: 30%; /* Adjust text position */
          text-align: center;
          text-shadow: 1px 1px 3px rgba(0,0,0,0.6);
        }
        .pointer-container {
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10;
            filter: drop-shadow(0 8px 6px rgba(0,0,0,0.5));
        }
        .pointer {
            width: 0;
            height: 0;
            border-left: 20px solid transparent;
            border-right: 20px solid transparent;
            border-top: 38px solid hsl(var(--destructive));
            position: relative;
        }
        .pointer::before {
            content: '';
            position: absolute;
            top: -42px;
            left: -12px;
            width: 24px;
            height: 24px;
            background: hsl(var(--card));
            border-radius: 50%;
            border: 5px solid hsl(var(--muted));
            box-shadow: 0 0 8px rgba(0,0,0,0.4);
            z-index: 1;
        }
         .pointer::after { /* Highlight on the pointer */
            content: '';
            position: absolute;
            top: -38px;
            left: 0;
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 18px solid hsl(var(--destructive) / 0.5);
            transform: translateX(-50%);
        }
        .wheel-center {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 20%;
            height: 20%;
            background: radial-gradient(circle, #E5E7EB, #9CA3AF);
            border-radius: 50%;
            border: 5px solid #6B7280;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.7), 0 0 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .wheel-center-inner {
             width: 50%;
             height: 50%;
             background: #374151;
             border-radius: 50%;
             border: 2px solid #1F2937;
             box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
        }
        .pin {
            position: absolute;
            top: calc(50% - 4px);
            left: calc(50% - 4px);
            width: 8px;
            height: 8px;
            background: radial-gradient(circle at 30% 30%, #f0f0f0, #a0a0a0);
            border-radius: 50%;
            box-shadow: 0 0 3px rgba(0,0,0,0.5);
            z-index: 10;
        }
      `}</style>
    </div>
  );
}
