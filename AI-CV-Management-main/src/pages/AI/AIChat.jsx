import { useState } from "react";

export default function AIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;

    // add user message
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");

    // call backend
    const res = await fetch("http://localhost:5000/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: newMessages }),
    });

    const data = await res.json();
    if (data.reply) {
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>AI Chat with Gemini</h2>
      <div style={{ marginBottom: 10, height: 300, overflowY: "auto", border: "1px solid #ccc", padding: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: "5px 0" }}>
            <b>{m.role}:</b> {m.content}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        style={{ width: "70%", marginRight: 10 }}
        placeholder="Nhập tin nhắn..."
      />
      <button onClick={sendMessage}>Gửi</button>
    </div>
  );
}
