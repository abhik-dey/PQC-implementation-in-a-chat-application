export default function MessageBubble({ text, isUser }) {
  const bubbleStyle = {
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: "12px",
    marginBottom: "8px",
    fontSize: "15px",
    lineHeight: "1.4",
    color: isUser ? "white" : "#111",
    backgroundColor: isUser ? "#2563eb" : "#e5e7eb",
    alignSelf: isUser ? "flex-end" : "flex-start",
    borderBottomLeftRadius: isUser ? "12px" : "0px",
    borderBottomRightRadius: isUser ? "0px" : "12px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)"
  };

  return <div style={bubbleStyle}>{text}</div>;
}
