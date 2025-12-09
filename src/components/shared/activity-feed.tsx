
"use client";

import { useEffect, useState } from "react";
import { getFirebase } from "@/lib/firebase/config";
import { doc, onSnapshot } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

interface Activity {
  id: number;
  name: string;
  type: "deposit" | "withdrawal" | "cpm_purchase" | "cpm_withdrawal";
  amount: number;
  isVip: boolean;
}

const names = [
  "Ali K.", "Usman A.", "Sarah M.", "Fatima A.", "Zainab H.", "David S.", "Emily J.", "Michael W.", "Jessica B.", "Daniel J."
];

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomActivity(previousActivity?: Activity | null): Activity {
  let name = names[Math.floor(Math.random() * names.length)];
  
  if(previousActivity) {
    while (name === previousActivity.name) {
      name = names[Math.floor(Math.random() * names.length)];
    }
  }

  const activityType = Math.random();
  let type: Activity['type'];
  let amount: number;

  if (activityType < 0.4) {
    type = "deposit";
    amount = getRandomInt(10, 500);
  } else if (activityType < 0.7) {
    type = "withdrawal";
    amount = getRandomInt(5, 300);
  } else if (activityType < 0.9) {
    type = "cpm_purchase";
    amount = getRandomInt(1, 50);
  } else {
    type = "cpm_withdrawal";
    amount = getRandomInt(10, 100);
  }

  const isVip = type === 'cpm_purchase' || type === 'cpm_withdrawal';

  return {
    id: Date.now() + Math.random(),
    name,
    type,
    amount,
    isVip,
  };
}

export default function SimulatedActivityFeed() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [nextActivity, setNextActivity] = useState<Activity | null>(null);

  const [position, setPosition] = useState<'idle' | 'enter' | 'exit'>('idle');
  const [nextPosition, setNextPosition] = useState<'idle' | 'enter' | 'exit'>('idle');


  useEffect(() => {
    const initializeListener = async () => {
        const { db } = await getFirebase();
        const settingsDocRef = doc(db, "system", "settings");

        const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setIsEnabled(data.simulatedActivityFeed !== false); // Default to true if undefined
          }
        });

        return () => unsubscribe();
    }
    initializeListener();
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      setActivity(null);
      setNextActivity(null);
      return;
    };
    
    if (!activity && !nextActivity) {
      const initialActivity = generateRandomActivity();
      setActivity(initialActivity);
      setPosition('enter');
      
      setTimeout(() => {
        setNextActivity(generateRandomActivity(initialActivity));
      }, 800)
    }

    const interval = setInterval(() => {
      setPosition('exit');
      setNextPosition('enter');
      
      setTimeout(() => {
        setActivity(nextActivity);
        setPosition('enter');
        setNextPosition('idle');
        
        setNextActivity(generateRandomActivity(nextActivity));
      }, 800);


    }, 4000);

    return () => clearInterval(interval);
  }, [isEnabled, activity, nextActivity]);

  if (!isEnabled) {
    return null;
  }
  
  const renderActivityMessage = (activity: Activity) => {
    let actionText = "";
    let unit = "";

    switch (activity.type) {
        case 'deposit':
            actionText = ' just deposited ';
            unit = '$';
            break;
        case 'withdrawal':
            actionText = ' just withdrew ';
            unit = '$';
            break;
        case 'cpm_purchase':
            actionText = ' just purchased ';
            unit = ' CPM';
            break;
        case 'cpm_withdrawal':
            actionText = ' just withdrew ';
            unit = ' CPM';
            break;
    }

    return (
        <>
            <span className="font-bold text-blue-400 flex items-center gap-1.5">
                {activity.name}
                {activity.isVip && (
                     <ShieldCheck className="h-3 w-3 text-yellow-400"/>
                )}
            </span>
            <span className="text-foreground/80">{actionText}</span>
            <span className="font-bold text-primary">{unit}{activity.amount}{unit === ' CPM' ? '' : ''}</span>
        </>
    )
  }

  return (
    <div className="sticky top-0 z-30 w-full bg-muted/40 border-b border-border/20 shadow-sm backdrop-blur-md">
      <div className="container mx-auto max-w-4xl flex items-center h-14 overflow-hidden">
        <div className="flex-shrink-0 flex items-center gap-3 pr-4 border-r border-border/20">
            <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <p className="text-sm font-bold text-foreground/80 whitespace-nowrap">Live</p>
        </div>
        <div className="flex-1 relative h-full flex items-center justify-start pl-8 md:pl-16 overflow-hidden">
            {activity && (
                 <div
                    key={activity.id}
                    className={cn(
                        "activity-item text-sm flex items-center gap-1",
                        position === 'enter' && "entering",
                        position === 'exit' && "exiting"
                    )}
                    >
                    {renderActivityMessage(activity)}
                </div>
            )}
            {nextActivity && (
                 <div
                    key={nextActivity.id}
                    className={cn(
                        "activity-item text-sm flex items-center gap-1",
                        nextPosition === 'enter' && "entering",
                        nextPosition === 'exit' && "exiting"
                    )}
                    >
                    {renderActivityMessage(nextActivity)}
                </div>
            )}
        </div>
      </div>
       <style jsx>{`
            .activity-item {
                position: absolute;
                transform: translateY(100%);
                opacity: 0;
                transition: transform 0.8s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1);
                white-space: nowrap;
            }
            .activity-item.entering {
                transform: translateY(0);
                opacity: 1;
            }
            .activity-item.exiting {
                transform: translateY(-100%);
                opacity: 0;
            }
        `}</style>
    </div>
  );
}
