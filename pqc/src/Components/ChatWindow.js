"use client";
import { useState } from "react";
import MessageBubble from "./MessageBubble";

export default function ChatWindow() {
  const [messages, setMessages] = useState([
    { text: "Welcome! 👋", isUser: false }
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { text: input, isUser: true }];
    setMessages(newMessages);
    setInput("");

    // Fake bot reply
    setTimeout(() => {
      setMessages((prev) => [...prev, { text: "Typing...", isUser: false }]);
      setTimeout(() => {
        setMessages((prev) => [
          ...prev.slice(0, prev.length - 1),
          { text: "Hello! How can I help? 😊", isUser: false }
        ]);
      }, 700);
    }, 500);
  };

  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "Arial, sans-serif",
    background: "#f8fafc"
  };

  const headerStyle = {
    background: "#2563eb",
    color: "white",
    padding: "15px",
    fontSize: "18px",
    fontWeight: "bold",
    position: "sticky",
    top: 0,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
  };

  const chatAreaStyle = {
    flex: 1,
    padding: "14px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  };

  const inputAreaStyle = {
    display: "flex",
    padding: "10px",
    background: "white",
    borderTop: "1px solid #ddd",
    gap: "10px"
  };

  const inputStyle = {
    flex: 1,
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    fontSize: "15px"
  };

  const buttonStyle = {
    padding: "10px 16px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "15px",
    cursor: "pointer"
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Chat Assistant 🤖</div>

      <div style={chatAreaStyle}>
        {messages.map((m, i) => (
          <MessageBubble key={i} text={m.text} isUser={m.isUser} />
        ))}
      </div>

      <div style={inputAreaStyle}>
        <input
          style={inputStyle}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button style={buttonStyle} onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
