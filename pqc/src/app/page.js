'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// --- Helper: Base64 utils ---
const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));

const styles = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5', fontFamily: 'Arial, sans-serif' },
  form: { padding: '2.5rem', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '400px', textAlign: 'center' },
  input: { width: '100%', padding: '12px', margin: '8px 0', border: '1px solid #ddd', borderRadius: '6px', boxSizing: 'border-box', fontSize: '1rem' },
  button: { width: '100%', padding: '12px', margin: '20px 0 10px', border: 'none', borderRadius: '6px', backgroundColor: '#0070f3', color: 'white', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' },
  keyButton: { width: '100%', padding: '10px', margin: '10px 0', border: '1px solid #0070f3', borderRadius: '6px', backgroundColor: '#f0f7ff', color: '#0070f3', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' },
  error: { color: '#e00', fontSize: '0.9rem', margin: '10px 0', backgroundColor: '#fff0f0', padding: '10px', borderRadius: '4px', border: '1px solid #ffcccc' },
  success: { color: '#0070f3', fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold' },
  toggle: { fontSize: '0.9rem', color: '#666', marginTop: '15px' },
  toggleButton: { background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer', padding: '0 0 0 5px', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'underline' },
  label: { display: 'block', textAlign: 'left', fontSize: '0.85rem', color: '#333', marginTop: '15px', marginBottom: '5px', fontWeight: 'bold' },
  fileInput: { fontSize: '0.9rem', marginTop: '5px', width: '100%' }
};

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [importedKey, setImportedKey] = useState(''); // Stores key read from file
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // --- PQC State ---
  const [pqcModule, setPqcModule] = useState(null);
  const [keysGenerated, setKeysGenerated] = useState(false);
  const [pqcPublicKey, setPqcPublicKey] = useState('');

  // 1. Load PQC WASM
  useEffect(() => {
    if (!pqcModule) {
      if (document.getElementById('pqc-script')) return;
      const script = document.createElement('script');
      script.id = 'pqc-script';
      script.src = '/pqc.js';
      script.async = true;
      script.onload = async () => {
        if (window.createPqcModule) {
          const mod = await window.createPqcModule();
          if (mod._init_pqc) mod._init_pqc();
          setPqcModule(mod);
          console.log("PQC Engine Loaded");
        }
      };
      document.body.appendChild(script);
    }
  }, [pqcModule]);

  // 2. Helper: Download Key File
  const downloadKeyFile = (key, user) => {
      const blob = new Blob([key], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${user}_private_key.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  // 3. Helper: Read Uploaded Key File
  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const keyContent = event.target.result.trim();
          setImportedKey(keyContent);
          setError(''); // Clear error if file selected
      };
      reader.readAsText(file);
  };

  // 4. Generate Keys
  const generateKeys = () => {
    if (!pqcModule) { setError("PQC Engine loading..."); return; }
    try {
      const pkLen = pqcModule._get_public_key_bytes();
      const skLen = pqcModule._get_secret_key_bytes();
      const pkPtr = pqcModule._malloc(pkLen);
      const skPtr = pqcModule._malloc(skLen);
      
      const res = pqcModule._generate_keypair(pkPtr, skPtr);
      
      if (res === 0) {
        const pkBytes = new Uint8Array(pqcModule.HEAPU8.subarray(pkPtr, pkPtr + pkLen));
        const skBytes = new Uint8Array(pqcModule.HEAPU8.subarray(skPtr, skPtr + skLen));
        
        const pkStr = toB64(pkBytes);
        const skStr = toB64(skBytes);
        
        localStorage.setItem(`pqc_sk_${username}`, skStr);
        setPqcPublicKey(pkStr);
        setKeysGenerated(true);
        setError("");
        
        // Auto-download
        downloadKeyFile(skStr, username);
        
      } else { setError("Key generation failed."); }
      
      pqcModule._free(pkPtr); pqcModule._free(skPtr);
    } catch (e) { setError("Error: " + e.message); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // --- STRICT SECURITY CHECK ---
    if (!isRegistering) {
        if (!importedKey) {
            // Check if key happens to be in storage (edge case), otherwise BLOCK
            const existing = localStorage.getItem(`pqc_sk_${username}`);
            if (!existing) {
                setError("⚠️ You must upload your Private Key file to log in.");
                return; // STOP EXECUTION HERE
            }
        } else {
            // Save the uploaded key
            localStorage.setItem(`pqc_sk_${username}`, importedKey);
        }
    }
    // -----------------------------
    
    const result = await signIn('credentials', {
      redirect: false,
      username,
      password,
    });

    if (result.error) {
      setError("Invalid username or password");
    } else {
      router.push('/chat');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!keysGenerated) {
      setError("Generate PQC Keys first.");
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, publicKey: pqcPublicKey }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error');

      await handleLogin(e);

    } catch (err) { setError(err.message); }
  };

  return (
    <div style={styles.container}>
      <form style={styles.form} onSubmit={isRegistering ? handleRegister : handleLogin}>
        <h2 style={{color: '#333', marginBottom: '20px'}}>{isRegistering ? 'Secure Registration' : 'Secure Login'}</h2>
        {error && <p style={styles.error}>{error}</p>}
        
        <input style={styles.input} type="text" placeholder="Username" value={username} onChange={(e) => { setUsername(e.target.value); if(isRegistering) setKeysGenerated(false); }} required />
        <input style={styles.input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        
        {/* --- Registration Mode --- */}
        {isRegistering && (
          <div style={{marginBottom: '10px'}}>
            {!keysGenerated ? (
              <button type="button" style={styles.keyButton} onClick={generateKeys} disabled={!username}>
                Generate Keys & Download
              </button>
            ) : (
              <p style={styles.success}>Keys Saved to Computer ✓</p>
            )}
          </div>
        )}

        {/* --- Login Mode --- */}
        {!isRegistering && (
            <div style={{marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '10px', textAlign: 'left'}}>
                <label style={styles.label}>Upload Private Key (Required):</label>
                <input 
                    type="file" 
                    accept=".txt"
                    onChange={handleFileUpload}
                    style={styles.fileInput}
                />
                {importedKey && <p style={{color: 'green', fontSize: '0.8rem', marginTop: '5px', fontWeight: 'bold'}}>Key Loaded ✓</p>}
            </div>
        )}

        <button style={styles.button} type="submit">
          {isRegistering ? 'Register' : 'Login'}
        </button>
        
        <p style={styles.toggle}>
          {isRegistering ? 'Already have an account?' : "Don't have an account?"}
          <button type="button" style={styles.toggleButton} onClick={() => { setIsRegistering(!isRegistering); setError(''); setKeysGenerated(false); }}>
            {isRegistering ? 'Login' : 'Register'}
          </button>
        </p>
      </form>
    </div>
  );
}