
"use client";

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import { getFirebase } from "@/lib/firebase/config";
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useAuth } from '@/context/auth-context';
import { User } from 'firebase/auth';

export const MaintenanceScreen = () => {
    const { user }: { user: User | null } = useAuth();
    const [popupOpen, setPopupOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    
    const ticketIdRef = useRef<string | null>(null);
    const chatContentRef = useRef<HTMLDivElement>(null);
    const isFirstMessageRef = useRef(true);

    useEffect(() => {
        let storedTicketId = localStorage.getItem('maintenanceTicketId');
        if (storedTicketId) {
            ticketIdRef.current = storedTicketId;
        }

        if (user) {
            setName(user.displayName || '');
            setEmail(user.email || '');
            if(!ticketIdRef.current) {
                const userTicketId = `user_${user.uid}`;
                ticketIdRef.current = userTicketId;
                localStorage.setItem('maintenanceTicketId', userTicketId);
            }
        }
    }, [user]);

    useEffect(() => {
        if (!ticketIdRef.current) return;

        const initializeListener = async () => {
            const { db } = await getFirebase();
            const messagesQuery = query(
                collection(db, "support_tickets", ticketIdRef.current!, "messages"),
                orderBy("timestamp", "asc")
            );

            const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
                const newMessages: any[] = [];
                let isNewAdminMessage = false;

                snapshot.docs.forEach(doc => {
                    const messageData = { id: doc.id, ...doc.data() };
                    newMessages.push(messageData);
                    
                    if (messageData.sender === 'admin' && !chatHistory.some(m => m.id === doc.id) && !popupOpen) {
                       isNewAdminMessage = true;
                    }
                });
                
                if (newMessages.length > 0) {
                    isFirstMessageRef.current = false;
                }

                if(isNewAdminMessage){
                    setHasNewMessage(true);
                }

                setChatHistory(newMessages);
            }, (error) => {
              console.error("Error fetching maintenance messages:", error);
            });
            
            return () => unsubscribe();
        };
        
        initializeListener();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketIdRef.current, popupOpen]);
    
    useEffect(() => {
        if (chatContentRef.current) {
            chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !message.trim()) {
            alert("Please fill all fields.");
            return;
        }
        setLoading(true);

        const { db } = await getFirebase();
        try {
            if (!ticketIdRef.current) {
                const newTicketRef = doc(collection(db, "support_tickets"));
                ticketIdRef.current = newTicketRef.id;
                localStorage.setItem('maintenanceTicketId', ticketIdRef.current);
            }

            const ticketDocRef = doc(db, "support_tickets", ticketIdRef.current);
            const ticketDoc = await getDoc(ticketDocRef);

            const messageData = {
                text: message,
                sender: "user",
                timestamp: serverTimestamp(),
            };

            await addDoc(collection(ticketDocRef, "messages"), messageData);

            if (!ticketDoc.exists()) {
                await setDoc(ticketDocRef, {
                    userName: name,
                    userEmail: email,
                    userId: user ? user.uid : 'guest_' + ticketIdRef.current,
                    createdAt: serverTimestamp(),
                    status: 'open',
                    lastMessage: message,
                });
            } else {
                 await updateDoc(ticketDocRef, {
                    status: 'open',
                    lastMessage: message,
                    createdAt: serverTimestamp()
                });
            }

            setMessage('');
            isFirstMessageRef.current = false;

        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message. Please try again.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleTogglePopup = () => {
        setPopupOpen(!popupOpen);
        if (hasNewMessage) {
            setHasNewMessage(false);
        }
    }

    return (
        <div className="maintenance-scene">
            <div className="scene-bg">
                <div className="clouds"></div>
                <div className="city-skyline"></div>
            </div>
            
            <div className="main-content">
                <div className="computer-screen">
                    <div className="screen-stand"></div>
                    <div className="screen-bezel">
                        <div className="screen-inner">
                            <div className="screen-text-content">
                                <h1 className="main-title">SYSTEM UPGRADE IN PROGRESS</h1>
                                <p className="subtitle">Our team is currently enhancing TradeVision for a better, faster, and more reliable experience. We appreciate your patience.</p>
                                <div className="status-box">
                                    STATUS: <span className="status-live">MAINTENANCE</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hanging-sign-container">
                    <div className="rope rope-left"></div>
                    <div className="rope rope-right"></div>
                    <div className="hanging-sign">
                        <span>UNDER CONSTRUCTION</span>
                    </div>
                </div>

                <div className="worker worker-ladder-carrier">
                    <div className="worker-body"></div>
                    <div className="worker-head"></div>
                    <div className="ladder"></div>
                </div>

                <div className="worker worker-fixer">
                    <div className="standing-ladder"></div>
                    <div className="worker-body"></div>
                    <div className="worker-head"></div>
                    <div className="spanner"></div>
                </div>

                <div className="worker worker-toolbox-holder">
                    <div className="worker-body"></div>
                    <div className="worker-head"></div>
                    <div className="toolbox"></div>
                </div>

                 <div className="worker worker-cone-mover">
                    <div className="worker-body"></div>
                    <div className="worker-head"></div>
                    <div className="cone carried-cone"></div>
                </div>

                <div className="cone cone-1"></div>
                <div className="cone cone-2"></div>

            </div>

            <div className="support-widget-container">
                <button className="support-float-button" onClick={handleTogglePopup}>
                    {hasNewMessage && <span className="support-notification-dot"></span>}
                     <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </button>

                {popupOpen && (
                    <div className="support-popup">
                        <div className="support-popup-header">
                            <div>
                                <h3>Contact Support</h3>
                                <p>We are here to help you</p>
                            </div>
                            <button onClick={() => setPopupOpen(false)} className="close-button">&times;</button>
                        </div>
                        <div className="support-popup-content" ref={chatContentRef}>
                            {chatHistory.map((chat) => (
                                <div key={chat.id} className={`chat-message ${chat.sender === 'admin' ? 'admin' : 'user'}`}>
                                    <p>{chat.text}</p>
                                    <span className="chat-timestamp">
                                        {chat.timestamp ? new Date(chat.timestamp.seconds * 1000).toLocaleTimeString() : 'Sending...'}
                                    </span>
                                </div>
                            ))}
                            {chatHistory.length === 0 && (
                                <div className="text-center text-sm text-gray-500 p-4">
                                    Have a question? Send us a message.
                                </div>
                            )}
                        </div>
                        <div className="support-popup-footer">
                            <form onSubmit={handleSubmit}>
                                {isFirstMessageRef.current && (
                                     <div className="form-grid">
                                        <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required disabled={!!user} />
                                        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required disabled={!!user}/>
                                     </div>
                                )}
                                <textarea placeholder="Type your message..." value={message} onChange={e => setMessage(e.target.value)} required></textarea>
                                <button type="submit" disabled={loading} className="send-button">
                                    {loading ? <div className="loader"></div> : 'Send'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                :root {
                    --orange-color: #F97316;
                    --dark-blue-color: #1E3A8A; 
                    --swing-speed: 4s;
                    --cloud-speed: 80s;
                    --worker-walk-speed: 25s;
                    --worker-fix-speed: 3s;
                }
                
                .maintenance-scene {
                    position: fixed;
                    inset: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: #F9FAFB;
                    overflow: hidden;
                    font-family: 'Inter', sans-serif;
                    z-index: 9999;
                }
                
                .scene-bg {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    bottom: 0;
                    left: 0;
                     background: linear-gradient(to top, #a1c4fd, #c2e9fb);
                }

                .clouds {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 200%;
                    height: 100%;
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 300"><path d="M150 150 C50 150 50 50 150 50 C250 50 250 150 150 150 Z" fill="rgba(255, 255, 255,0.9)"/><path d="M350 180 C250 180 250 80 350 80 C450 80 450 180 350 180 Z" fill="rgba(255, 255, 255,0.8)"/><path d="M600 120 C500 120 500 20 600 20 C700 20 700 120 600 120 Z" fill="rgba(255, 255, 255,0.85)"/><path d="M800 200 C700 200 700 100 800 100 C900 100 900 200 800 200 Z" fill="rgba(255, 255, 255,0.7)"/></svg>');
                    background-repeat: repeat-x;
                    animation: move-clouds var(--cloud-speed) linear infinite;
                    opacity: 0.6;
                }

                @keyframes move-clouds {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }

                .city-skyline {
                    position: absolute;
                    bottom: 0;
                    width: 200%;
                    height: 50%;
                    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 200"><path d="M0 200 L0 150 L50 150 L50 100 L100 100 L100 200 Z" fill="%236B7280"/><path d="M100 200 L100 80 L120 60 L140 80 L140 200 Z" fill="%239CA3AF"/><path d="M140 200 L140 120 L200 120 L200 50 L220 50 L220 200 Z" fill="%236B7280"/><path d="M220 200 L220 160 L280 160 L280 200 Z" fill="%239CA3AF"/><path d="M280 200 L280 100 L300 100 L300 80 L320 80 L320 100 L340 100 L340 200 Z" fill="%236B7280"/><path d="M340 200 L340 140 L400 140 L400 200 Z" fill="%239CA3AF"/><path d="M400 200 L400 80 L450 30 L500 80 L500 200 Z" fill="%236B7280"/><path d="M500 200 L500 150 L600 150 L600 200 Z" fill="%239CA3AF"/><path d="M600 200 L600 100 L680 100 L680 200 Z" fill="%236B7280"/><path d="M680 200 L680 130 L750 130 L750 160 L800 160 L800 200 Z" fill="%239CA3AF"/><path d="M800 200 L800 150 L850 150 L850 100 L900 100 L900 200 Z" fill="%234B5563"/><path d="M900 200 L900 80 L920 60 L940 80 L940 200 Z" fill="%236B7280"/><path d="M940 200 L940 120 L1000 120 L1000 50 L1020 50 L1020 200 Z" fill="%234B5563"/><path d="M1020 200 L1020 160 L1080 160 L1080 200 Z" fill="%236B7280"/><path d="M1080 200 L1080 100 L1100 100 L1100 80 L1120 80 L1120 100 L1140 100 L1140 200 Z" fill="%234B5563"/><path d="M1140 200 L1140 140 L1200 140 L1200 200 Z" fill="%236B7280"/><path d="M1200 200 L1200 80 L1250 30 L1300 80 L1300 200 Z" fill="%234B5563"/><path d="M1300 200 L1300 150 L1400 150 L1400 200 Z" fill="%236B7280"/><path d="M1400 200 L1400 100 L1480 100 L1480 200 Z" fill="%234B5563"/><path d="M1480 200 L1480 130 L1550 130 L1550 160 L1600 160 L1600 200 Z" fill="%236B7280"/></svg>');
                    background-size: auto 100%;
                    background-repeat: repeat-x;
                    background-position: bottom left;
                    animation: move-skyline 120s linear infinite;
                }
                
                @keyframes move-skyline {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }

                .main-content {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .computer-screen {
                    position: relative;
                    width: 60vw;
                    max-width: 900px;
                    height: 40vw;
                    max-height: 600px;
                }
                
                .screen-bezel {
                    width: 100%;
                    height: 100%;
                    background: #2F2F2F;
                    border-radius: 20px;
                    padding: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.1);
                    border: 2px solid #4A4A4A;
                }
                
                .screen-inner {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #111827 0%, #000 100%);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    padding: 2rem;
                    color: white;
                }

                .screen-stand {
                    position: absolute;
                    bottom: -30px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 20%;
                    height: 30px;
                    background: #4A4A4A;
                    border-bottom-left-radius: 10px;
                    border-bottom-right-radius: 10px;
                }
                .screen-stand::after {
                    content: '';
                    position: absolute;
                    bottom: -10px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 150%;
                    height: 10px;
                    background: #2F2F2F;
                    border-radius: 5px;
                }

                .screen-text-content { max-width: 80%; }
                .main-title { 
                    font-size: clamp(1.2rem, 3vw, 2rem); 
                    margin-bottom: 1.5rem; 
                    font-weight: 900;
                    color: yellow;
                    text-shadow: 0 0 5px rgba(255,255,0,0.5), 0 0 10px rgba(255,255,0,0.5), 0 0 2px black;
                }
                .subtitle { 
                    font-size: clamp(0.9rem, 1.5vw, 1.2rem);
                    margin-bottom: 2rem; 
                    color: #D1D5DB;
                }
                .status-box { 
                    display: inline-block; 
                    background: #111827;
                    border: 1px solid #374151;
                    padding: 0.5rem 1rem; 
                    border-radius: 8px; 
                    font-weight: 700;
                    margin-top: 1.5rem;
                }
                .status-live { 
                    color: yellow; 
                    font-weight: bold;
                }
                
                .hanging-sign-container {
                    position: absolute;
                    top: 10%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 300px;
                    height: 200px;
                    transform-origin: top center;
                    animation: swing var(--swing-speed) ease-in-out infinite;
                }

                .rope { position: absolute; top: 0; width: 4px; height: 100px; background: #8b5e34; }
                .rope-left { left: 20px; }
                .rope-right { right: 20px; }
                
                .hanging-sign {
                    position: absolute;
                    top: 90px; left: 0; width: 100%; height: 60px;
                    background: #d4a373;
                    border: 5px solid #8b5e34;
                    border-radius: 5px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.2rem; font-weight: bold; color: #333;
                    text-transform: uppercase;
                    box-shadow: 0 5px 10px rgba(0,0,0,0.1);
                }
                .hanging-sign span {
                    font-weight: 900;
                    color: #000;
                }

                @keyframes swing {
                    0% { transform: translateX(-50%) rotate(3deg); }
                    50% { transform: translateX(-50%) rotate(-3deg); }
                    100% { transform: translateX(-50%) rotate(3deg); }
                }

                .worker { position: absolute; }
                .worker-body { width: 30px; height: 50px; background: var(--dark-blue-color); border-radius: 10px 10px 0 0; }
                .worker-head { width: 25px; height: 25px; background: var(--orange-color); border-radius: 50%; position: absolute; top: -15px; left: 2.5px; }
                
                .worker-ladder-carrier { bottom: 10%; left: -100px; animation: walk-across var(--worker-walk-speed) linear infinite; }
                .ladder { position: absolute; top: 10px; left: -50px; width: 120px; height: 15px; background: #a16207; border: 2px solid #784d15; transform: rotate(-10deg); }

                @keyframes walk-across {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(110vw); }
                }
                
                .worker-fixer { bottom: calc(40vw + 10px); right: calc(30vw - 120px); animation: fix-it var(--worker-fix-speed) ease-in-out infinite; }
                .standing-ladder { position: absolute; bottom: -150px; left: -20px; width: 80px; height: 160px; border-left: 10px solid #a16207; border-right: 10px solid #a16207; }
                .standing-ladder::before, .standing-ladder::after { content: ''; position: absolute; width: 100%; height: 5px; background: #784d15; }
                .standing-ladder::before { top: 30px; }
                .standing-ladder::after { top: 80px; }
                .spanner { position: absolute; width: 40px; height: 10px; background: #9ca3af; top: 25px; right: -20px; transform-origin: center right; }

                @keyframes fix-it {
                    0%, 100% { transform: rotate(0deg); }
                    25% { transform: rotate(10deg); }
                    75% { transform: rotate(-10deg); }
                }

                .worker-toolbox-holder { bottom: 15%; left: 20%; animation: slight-move 5s ease-in-out infinite; }
                .toolbox { position: absolute; bottom: 0; right: -40px; width: 35px; height: 25px; background: #ef4444; border-radius: 3px; }

                @keyframes slight-move { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

                .worker-cone-mover { bottom: 5%; right: 10%; }
                .carried-cone { position: absolute; top: 15px; left: -25px; }
                
                .cone { width: 30px; height: 40px; background: linear-gradient(-45deg, var(--orange-color) 25%, white 25%, white 50%, var(--orange-color) 50%, var(--orange-color) 75%, white 75%); background-size: 20px 20px; clip-path: polygon(50% 0, 100% 100%, 0 100%); position: absolute; }
                .cone-1 { bottom: 5%; left: 30%; }
                .cone-2 { bottom: 5%; right: 30%; }
                
                @media (max-width: 768px) {
                    .computer-screen { width: 90vw; height: 75vw; max-height: 500px; }
                    .worker-fixer { display: none; }
                    .hanging-sign-container { width: 200px; height: 150px; }
                    .hanging-sign { height: 40px; font-size: 0.8rem; top: 70px; }
                    .rope { height: 80px; }
                    .main-title { font-size: 1rem; }
                    .subtitle { font-size: 0.8rem; }
                    .worker-ladder-carrier, .worker-toolbox-holder { display: none; }
                }

                .support-widget-container {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    z-index: 10000;
                }
                .support-float-button {
                    width: 60px;
                    height: 60px;
                    background-color: #1E3A8A;
                    color: white;
                    border-radius: 50%;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    transition: transform 0.2s;
                    position: relative;
                }
                .support-float-button:hover {
                    transform: scale(1.1);
                }
                .support-notification-dot {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 12px;
                    height: 12px;
                    background-color: var(--orange-color);
                    border-radius: 50%;
                    border: 2px solid white;
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(249, 115, 22, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
                }

                .support-popup {
                    position: absolute;
                    bottom: 80px;
                    right: 0;
                    width: 350px;
                    max-width: 90vw;
                    height: 500px;
                    max-height: 80vh;
                    background-color: #ffffff;
                    border-radius: 15px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    border: 1px solid #E5E7EB;
                }

                .support-popup-header {
                    padding: 1rem 1.5rem;
                    background-color: #1E3A8A;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .support-popup-header h3 {
                    margin: 0;
                    font-weight: 900;
                    font-size: 1.1rem;
                    color: white;
                }
                 .support-popup-header p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: white;
                    font-weight: bold;
                 }
                .close-button {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: white;
                    font-weight: bold;
                }
                
                .support-popup-content {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    background-color: #F9FAFB;
                }

                .chat-message {
                    padding: 0.5rem 1rem;
                    border-radius: 12px;
                    max-width: 85%;
                    word-wrap: break-word;
                }
                .chat-message.user {
                    background-color: #DBEAFE;
                    color: #1F2937;
                    align-self: flex-end;
                }
                .chat-message.admin {
                    background-color: #E5E7EB;
                    color: #1F2937;
                    align-self: flex-start;
                }
                .chat-message p { margin: 0; font-size: 0.9rem; }
                .chat-timestamp {
                    display: block;
                    font-size: 0.7rem;
                    margin-top: 0.25rem;
                    text-align: right;
                    opacity: 0.6;
                }

                .support-popup-footer {
                    padding: 1rem;
                    background-color: #FFF;
                    border-top: 1px solid #E5E7EB;
                }
                .support-popup-footer form {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                 .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                 }
                .support-popup-footer input, .support-popup-footer textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #D1D5DB;
                    border-radius: 8px;
                    font-family: 'Inter', sans-serif;
                    background-color: #FFF;
                    color: #000;
                }
                 .support-popup-footer input:focus, .support-popup-footer textarea:focus {
                    outline: none;
                    border-color: #1E3A8A;
                 }
                .support-popup-footer textarea {
                    resize: none;
                    min-height: 60px;
                }
                .send-button {
                    padding: 0.75rem;
                    border: none;
                    border-radius: 8px;
                    background-color: #1E3A8A;
                    color: white;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .send-button:hover:not(:disabled) {
                    background-color: #2563EB;
                }
                .send-button:disabled {
                    background-color: #9CA3AF;
                    cursor: not-allowed;
                }
                .loader {
                    width: 18px;
                    height: 18px;
                    border: 2px solid #FFF;
                    border-bottom-color: transparent;
                    border-radius: 50%;
                    display: inline-block;
                    box-sizing: border-box;
                    animation: rotation 1s linear infinite;
                    margin: 0 auto;
                }
                @keyframes rotation {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

            `}</style>
        </div>
    );
};
