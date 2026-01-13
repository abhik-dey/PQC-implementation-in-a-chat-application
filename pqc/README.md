# 🚀 Post-Quantum Secure Chat (Assignment 5)

This is a secure real-time messaging application implementing **Hybrid Encryption** (**Post-Quantum Kyber512** + **Classical AES-GCM**).  
It ensures **Forward Secrecy**, **Double Encryption**, and strong protection against **future quantum decryption attacks**.

---

## ✨ Features

- 🔐 **Post-Quantum Key Exchange:**  
  Uses **liboqs** (Kyber512) compiled to WebAssembly via Emscripten.

- 🤝 **Hybrid Encryption:**  
  AES-GCM for message encryption + Kyber512 for encapsulating session keys.

- 🔄 **Forward Secrecy:**  
  Every message uses a **fresh shared secret**.

- 👁️ **Double Encryption:**  
  Sender encrypts a separate copy so the server cannot read chat history.

- ⚡ **Performance Optimized:**  
  WASM is initialized once (Singleton pattern) and keys remain cached in-memory.

- 🔑 **Automatic Key Lifecycle:**
  - **Registration:** Private key auto-downloads to the user's device.
  - **Login:** User must upload private key to decrypt chat.
  - **Logout:** Private key is **hard-deleted** from browser storage.

---

## 🛠️ Project Setup (For Evaluators)

### 1️⃣ Prerequisites
- Node.js **v16+**
- MongoDB (Atlas or Local)

---

### 2️⃣ Git Clone & Install

```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>
cd <YOUR_PROJECT_FOLDER_NAME>

# Install dependencies
npm install
```

---

### 3️⃣ Environment Configuration

Create a file named **.env.local** in the project root:

```
MONGODB_URI=your_mongodb_connection_string
NEXTAUTH_SECRET=your_random_secret_string
NEXTAUTH_URL=http://localhost:3000
```

*(If the assignment was submitted via ZIP or private repo, this file may already exist.)*

---

### 4️⃣ Running the Application

Start the development server (this also serves the `pqc.wasm` engine automatically):

```bash
npm run dev
```

Now open:

👉 http://localhost:3000

---

## 🔒 Post-Quantum Compilation (Reference Only)

**You DO NOT need to run this command to evaluate the project.**  
The generated `pqc.wasm` and `pqc.js` are already included.

This is the exact command used to compile `pqc_wrapper.c` using Emscripten:

```bash
emcc pqc_wrapper.c \
  ~/liboqs/build/lib/liboqs.a \
  -I ~/liboqs/build/include \
  -o public/pqc.js \
  -O3 \
  -flto \
  -s WASM=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createPqcModule" \
  -s EXPORTED_FUNCTIONS="['_malloc', '_free']" \
  -s EXPORTED_RUNTIME_METHODS="['HEAPU8']" \
  -s NO_EXIT_RUNTIME=1 \
  -s ENVIRONMENT=web
```

---

## 🧪 How to Verify Security

### ✅ 1. Registration & Key Download

1. Go to **Register**
2. Enter username + password
3. Click **Generate Keys & Download**
4. A file like `username_private_key.txt` will be downloaded
5. Click **Register**

---

### ✅ 2. Secure Login & Key Import

1. Go to **Login**
2. Enter credentials
3. Click **Choose File** and upload your private key file
4. Click **Login**
5. Chat history should decrypt correctly

---

### ✅ 3. Verify Encryption (Network Tab)

1. Open **DevTools > Network > WS**
2. Send a message
3. Inspect WebSocket packets  
   You will see:
   - `kem` (Kyber ciphertext, ~768 bytes)
   - `iv` (AES-GCM initialization vector)
   - `text` (AES-GCM ciphertext)

---

### ✅ 4. Verify Forward Secrecy

Send **"Hello"** twice.

You will notice:
- Different AES ciphertext each time
- Different Kyber ciphertext (`kem`)
- Proves each message uses a new shared secret

---

### ✅ 5. Verify Private Key Deletion on Logout

1. Click **Logout**
2. Open **DevTools → Application/Storage → Local Storage**
3. Confirm:
   ```
   pqc_sk_<username>
   ```
   is **deleted**

---

## 📂 Project Structure

```
src/app/chat/page.js
    → Main chat UI
    → PQC Encapsulate/Decapsulate logic
    → Key Caching + Double Encryption
    → Chat history decryption

src/app/page.js
    → Login & Register pages
    → Key generation, auto-download, key upload

src/lib/socket-handler.cjs
    → Socket.IO backend
    → Message routing + async DB saving

pqc_wrapper.c
    → C interface for liboqs (Kyber512)
    → Compiled to WebAssembly

public/pqc.wasm
    → The Post-Quantum engine (WASM)
```

---

## 🎉 End of README  
You're ready to run, test, and evaluate the full Post-Quantum Secure Chat system!
