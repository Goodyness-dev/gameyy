import React, { useState, useEffect, useRef, useCallback } from 'react';

const LiveChat = () => {
  const [messages, setMessages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const messagesEndRef = useRef(null);
  const isMutedRef = useRef(false);

  // Keep ref in sync with state so the SSE callback always has the latest value
  useEffect(() => { 
    isMutedRef.current = isMuted; 
    if (isMuted && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [isMuted]);

  const speakText = useCallback((text) => {
    if (isMutedRef.current) return;
    if (!window.speechSynthesis) return;
    // Cancel any currently speaking utterance
    window.speechSynthesis.cancel();

    // Strip emojis so the browser TTS doesn't read them out loud
    const cleanText = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const eventSource = new EventSource(`${apiUrl}/api/live-chat/stream`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'connected') return;
      
      if (data.type === 'chat_message') {
        setMessages(prev => [...prev, data]);
        
        if (data.text && data.text.includes('FULL TIME')) {
          setIsMuted(true);
          if (window.speechSynthesis) window.speechSynthesis.cancel();
        } else {
          // Speak the message text using browser TTS
          speakText(data.text);
        }
      }
    };

    return () => eventSource.close();
  }, [speakText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="live-chat-panel">
      <div className="live-chat-header">
        <h3><span className="live-dot"></span> 🎙️ Pulse Commentary</h3>
        <button className="mute-btn" onClick={() => setIsMuted(!isMuted)}>
          {isMuted ? '🔇 Muted' : '🔊 Sound On'}
        </button>
      </div>
      
      <div className="live-chat-messages">
        {messages.length === 0 && (
          <div className="empty-chat">
            <div className="pulse-loader"></div>
            Waiting for live events...
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="chat-message slide-in">
            <div className="chat-avatar">🤖</div>
            <div className="chat-content">
              <span className="chat-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
              <p>{msg.text}</p>
              <button className="replay-btn" onClick={() => speakText(msg.text)}>▶️ Replay Audio</button>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <style>{`
        .live-chat-panel {
          background: #111513;
          border: 1px solid var(--cr-dd);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          height: 450px;
          overflow: hidden;
          margin-top: 1.5rem;
          box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        }
        .live-chat-header {
          padding: 1rem 1.25rem;
          background: rgba(10, 10, 10, 0.95);
          border-bottom: 1px solid var(--cr-dd);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .live-chat-header h3 {
          margin: 0;
          font-size: 16px;
          color: var(--tm);
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
        }
        .live-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: #ef4444;
          border-radius: 50%;
          animation: blink 1.5s infinite;
        }
        @keyframes blink {
          0% { opacity: 1; box-shadow: 0 0 8px #ef4444; }
          50% { opacity: 0.3; box-shadow: none; }
          100% { opacity: 1; box-shadow: 0 0 8px #ef4444; }
        }
        .mute-btn {
          background: #1a1f1c;
          border: 1px solid var(--tm2);
          color: var(--tm);
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .mute-btn:hover {
          background: var(--cr-dd);
          color: white;
          border-color: var(--gd);
        }
        .live-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        /* Custom scrollbar */
        .live-chat-messages::-webkit-scrollbar {
          width: 6px;
        }
        .live-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }
        .live-chat-messages::-webkit-scrollbar-thumb {
          background: var(--cr-dd);
          border-radius: 10px;
        }
        .empty-chat {
          text-align: center;
          color: var(--tm2);
          font-style: italic;
          margin-top: 4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .pulse-loader {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(212, 175, 55, 0.2);
          animation: pulseRing 2s infinite;
        }
        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4); }
          70% { transform: scale(1.2); opacity: 0.8; box-shadow: 0 0 0 20px rgba(212, 175, 55, 0); }
          100% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
        }
        .chat-message {
          display: flex;
          gap: 12px;
          background: linear-gradient(145deg, rgba(30, 35, 32, 0.8), rgba(20, 24, 22, 0.6));
          padding: 14px;
          border-radius: 14px;
          border-left: 3px solid var(--gd);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .slide-in {
          animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .chat-avatar {
          font-size: 26px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        .chat-content {
          flex: 1;
        }
        .chat-time {
          font-size: 11px;
          color: var(--tm2);
          margin-bottom: 6px;
          display: block;
          font-weight: 500;
          letter-spacing: 0.5px;
        }
        .chat-content p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: #f1f5f9;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        .replay-btn {
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.3);
          color: var(--gd);
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          margin-top: 10px;
          cursor: pointer;
          padding: 4px 10px;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .replay-btn:hover {
          background: rgba(212, 175, 55, 0.2);
          border-color: var(--gd);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};

export default LiveChat;
