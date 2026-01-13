'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import io from 'socket.io-client';

let pqcModule; 

const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (str) => new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));

const aesEncrypt = async (keyBytes, text, ivBytes) => {
    const key = await window.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes }, key, encoded);
    return toB64(new Uint8Array(ciphertext));
};

const aesDecrypt = async (keyBytes, ctB64, ivB64) => {
    const key = await window.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
    const ct = fromB64(ctB64);
    const iv = fromB64(ivB64);
    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
    return new TextDecoder().decode(decrypted);
};

function kyberEncapsulate(pkB64, module) {
    if (!module) throw new Error("WASM Module not loaded");
    const pkBytes = fromB64(pkB64);
    const ctLen = module._get_ciphertext_bytes();
    const ssLen = module._get_shared_secret_bytes();
    const ctPtr = module._malloc(ctLen);
    const ssPtr = module._malloc(ssLen);
    const pkPtr = module._malloc(pkBytes.length);
    module.HEAPU8.set(pkBytes, pkPtr);
    module._encapsulate(ctPtr, ssPtr, pkPtr);
    const ct = new Uint8Array(module.HEAPU8.subarray(ctPtr, ctPtr + ctLen));
    const ss = new Uint8Array(module.HEAPU8.subarray(ssPtr, ssPtr + ssLen));
    module._free(pkPtr); module._free(ctPtr); module._free(ssPtr);
    return { kem: toB64(ct), ss };
}

function kyberDecapsulate(kemB64, skB64, module) {
    if (!module) return null;
    const kemCt = fromB64(kemB64);
    const mySk = fromB64(skB64);
    const ssLen = module._get_shared_secret_bytes();
    const ssPtr = module._malloc(ssLen);
    const ctPtr = module._malloc(kemCt.length);
    const skPtr = module._malloc(mySk.length);
    module.HEAPU8.set(mySk, skPtr);
    module.HEAPU8.set(kemCt, ctPtr);
    const res = module._decapsulate(ssPtr, ctPtr, skPtr);
    const ss = new Uint8Array(module.HEAPU8.subarray(ssPtr, ssPtr + ssLen));
    module._free(skPtr); module._free(ctPtr); module._free(ssPtr);
    return res === 0 ? ss : null;
}

async function decryptPayload(msg, mySk, module) {
    try {
        const sessionKey = kyberDecapsulate(msg.kem, mySk, module);
        if (!sessionKey) throw new Error("Kyber Decap Failed");
        return await aesDecrypt(sessionKey, msg.text, msg.iv);
    } catch (e) {
        return "⚠️ [Decryption Error]";
    }
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f0f2f5', fontFamily: 'Arial, sans-serif', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mainWrapper: { width: '90%', maxWidth: '900px', height: '90vh', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '1.5rem', backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  title: { fontSize: '1.2rem', fontWeight: 'bold', color: '#333' },
  contentArea: { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', gap: '15px', backgroundColor: '#f9f9f9', overflow: 'hidden', minHeight: 0 },
  recipientBox: { padding: '10px', backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  recipientInput: { width: '100%', border: 'none', outline: 'none', fontSize: '1rem', marginLeft: '10px' },
  chatBox: { flex: 1, padding: '1rem', backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 },
  msg: { padding: '0.8rem 1.2rem', borderRadius: '18px', maxWidth: '70%', wordWrap: 'break-word', fontSize: '0.95rem', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
  myMsg: { alignSelf: 'flex-end', backgroundColor: '#0070f3', color: 'white', borderBottomRightRadius: '4px' },
  theirMsg: { alignSelf: 'flex-start', backgroundColor: '#e4e6eb', color: '#050505', borderBottomLeftRadius: '4px' },
  encryptedMsg: { fontStyle: 'italic', color: '#ccc', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' },
  inputArea: { padding: '1rem', backgroundColor: 'white', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '10px', flexShrink: 0 },
  messageInput: { flex: 1, padding: '12px', borderRadius: '24px', border: '1px solid #ccc', outline: 'none', fontSize: '1rem' },
  btn: { padding: '10px 24px', borderRadius: '24px', border: 'none', backgroundColor: '#0070f3', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' },
  logoutBtn: { padding: '8px 16px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem' },
  keyBtn: { padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', marginRight: '10px' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2rem', color: 'black' }
};

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [recipient, setRecipient] = useState('');
  const [isReady, setIsReady] = useState(false);
  const messagesEndRef = useRef(null);
  
  const socketRef = useRef(null);
  const recipientRef = useRef('');
  const pqcModuleRef = useRef(null); 
  const keyCache = useRef({ recipient: null, mine: null });

  useEffect(() => {
    recipientRef.current = recipient;
    keyCache.current.recipient = null; 
  }, [recipient]);

  useEffect(() => { if (status === 'unauthenticated') router.push('/'); }, [status, router]);

  // A. Load WASM
  useEffect(() => {
    const loadWasm = async () => {
        if (pqcModuleRef.current) {
            setIsReady(true);
            return;
        }
        if (window.createPqcModule) {
            const mod = await window.createPqcModule();
            if (mod._init_pqc) mod._init_pqc();
            pqcModuleRef.current = mod;
            setIsReady(true);
        }
    };
    if (!window.createPqcModule) {
        const script = document.createElement('script');
        script.src = '/pqc.js';
        script.onload = loadWasm;
        document.body.appendChild(script);
    } else { loadWasm(); }
  }, []);

  // B. Connect Socket
  useEffect(() => {
      if (!session?.user?.username) return;
      if (!socketRef.current) {
          socketRef.current = io({ auth: { username: session.user.username }, path: '/api/socket_io', transports: ['websocket'] });
          
          socketRef.current.on('receive_message', async (msg) => {
              if (msg.receiver !== session.user.username) return;
              
              const skStr = localStorage.getItem(`pqc_sk_${session.user.username}`);
              if (!skStr || !pqcModuleRef.current) return; 
              
              const payload = { kem: msg.kem, text: msg.text, iv: msg.iv };
              const plaintext = await decryptPayload(payload, skStr, pqcModuleRef.current);
              
              if (msg.sender === recipientRef.current) {
                  setMessages(prev => [...prev, { sender: msg.sender, text: plaintext }]);
              } 
          });
      }
      return () => { if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; } };
  }, [session]);

  // C. Fetch History & Prefetch Keys
  useEffect(() => {
    if (!recipient || !session?.user?.username || !isReady) {
        setMessages([]); 
        return;
    }

    const fetchHistoryAndKeys = async () => {
        if (socketRef.current && !socketRef.current.connected) return;

        try {
            const promises = [];
            if (!keyCache.current.recipient) promises.push(fetch(`/api/keys?username=${recipient}`).then(r => r.json()).then(d => keyCache.current.recipient = d.publicKey));
            if (!keyCache.current.mine) promises.push(fetch(`/api/keys?username=${session.user.username}`).then(r => r.json()).then(d => keyCache.current.mine = d.publicKey));
            
            const historyPromise = fetch(`/api/messages?user1=${session.user.username}&user2=${recipient}`).then(r => r.json());
            await Promise.all([...promises, historyPromise]); 
            
            const history = await historyPromise;
            const skStr = localStorage.getItem(`pqc_sk_${session.user.username}`);
            if (!skStr || !pqcModuleRef.current) return;

            const decryptedHistory = await Promise.all(history.map(async (msg) => {
                let targetKem, targetText;
                
                if (msg.sender === session.user.username) {
                    targetKem = msg.senderKem;
                    targetText = msg.senderText;
                } else {
                    targetKem = msg.kem;
                    targetText = msg.text;
                }

                if (!targetKem || !targetText) return { ...msg, text: "🔒 Encrypted (Key Missing)" };

                const payload = { kem: targetKem, text: targetText, iv: msg.iv };
                const ss = await decryptPayload(payload, skStr, pqcModuleRef.current);
                
                return { ...msg, text: ss, sender: (msg.sender === session.user.username ? 'Me' : msg.sender) };
            }));
            setMessages(decryptedHistory);
        } catch (e) {
            // silent fail
        }
    };

    const timeoutId = setTimeout(() => fetchHistoryAndKeys(), 500);
    return () => clearTimeout(timeoutId);
  }, [recipient, isReady, session?.user?.username]); 

  // D. Send Message
  const sendMessage = async () => {
      if(!recipient || !input || !isReady || !socketRef.current || !pqcModuleRef.current) return;

      const myMessageText = input;
      setInput('');
      setMessages(prev => [...prev, { sender: 'Me', text: myMessageText }]);

      try {
        if (!keyCache.current.recipient || !keyCache.current.mine) return; 

        const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));
        const ivB64 = toB64(ivBytes);

        // 1. Encrypt for Receiver
        const { kem: kemForReceiver, ss: ssForReceiver } = kyberEncapsulate(keyCache.current.recipient, pqcModuleRef.current);
        const textForReceiver = await aesEncrypt(ssForReceiver, myMessageText, ivBytes);

        // 2. Encrypt for Sender (History)
        const { kem: kemForSender, ss: ssForSender } = kyberEncapsulate(keyCache.current.mine, pqcModuleRef.current);
        const textForSender = await aesEncrypt(ssForSender, myMessageText, ivBytes);

        const payload = {
            sender: session.user.username,
            receiver: recipient,
            text: textForReceiver,     
            kem: kemForReceiver,
            senderText: textForSender,
            senderKem: kemForSender,
            iv: ivB64
        };
        
        socketRef.current.emit('send_message', payload);

      } catch (err) { console.error(err); }
  };

  // Helper: Download Key File manually
  const downloadKey = () => {
      const sk = localStorage.getItem(`pqc_sk_${session.user.username}`);
      if(sk) {
          const blob = new Blob([sk], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${session.user.username}_private_key.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } else alert("No key found!");
  };

  // --- LOGOUT LOGIC: DELETE KEY ---
  const handleLogout = () => {
      localStorage.removeItem(`pqc_sk_${session.user.username}`); // Delete from storage
      signOut({ callbackUrl: '/' });
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  if (status === 'loading') return <div style={styles.loading}>Loading...</div>;
  if (!session) return <div style={styles.loading}>Please Log In</div>;

  return (
    <div style={styles.container}>
      <div style={styles.mainWrapper}>
        <header style={styles.header}>
          <div style={styles.title}>Welcome, {session.user.username}</div>
          <div style={{display:'flex', gap:'10px'}}>
            <button onClick={downloadKey} style={styles.keyBtn}>Backup Key</button>
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </div>
        </header>
        <div style={styles.contentArea}>
          <div style={styles.recipientBox}>
            <span style={{fontWeight:'bold', color:'#555'}}>To:</span>
            <input style={styles.recipientInput} placeholder="Enter username" value={recipient} onChange={e=>setRecipient(e.target.value)} autoComplete="off" />
          </div>
          <main style={styles.chatBox}>
            {messages.map((m, i) => (
              <div key={i} style={{...styles.msg, ...(m.sender === 'Me' ? styles.myMsg : styles.theirMsg)}}>
                {m.isLocked ? ( <span style={styles.encryptedMsg}>{m.text}</span> ) : ( m.text )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </main>
        </div>
        <div style={styles.inputArea}>
          <input style={styles.messageInput} placeholder="Type a secure message..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} autoComplete="off" />
          <button onClick={sendMessage} style={styles.btn} disabled={!isReady}>Send</button>
        </div>
      </div>
    </div>
  );
}