import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

// --- IndexedDB helper ---
const DB_NAME = "bluetoothChatDB";
const STORE_NAME = "profile";

function saveUsername(name) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ id: "username", value: name });
      tx.oncomplete = () => resolve();
    };
    open.onerror = reject;
  });
}

function loadUsername() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get("username");
      req.onsuccess = () => resolve(req.result?.value || "User");
      req.onerror = reject;
    };
    open.onerror = reject;
  });
}

// --- App Component ---
function App() {
  const [devices, setDevices] = useState([]);
  const [username, setUsername] = useState("User");

  useEffect(() => {
    loadUsername().then((name) => setUsername(name));
  }, []);

  // Scan Nearby Devices (Web Bluetooth chooser)
  const scanNearby = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service"],
      });
      setDevices((prev) => [...prev, device]);
    } catch (err) {
      console.error("Scan error:", err);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.profile}>
          <div style={styles.avatar}></div>
          <span style={styles.username}>{username}</span>
        </div>
        <button style={styles.qrBtn}>My QR</button>
        <button style={styles.threeDots}>⋮</button>
      </div>

      {/* Connection List */}
      <div style={styles.connectionList}>
        <span style={{ color: "#fff", fontWeight: "bold" }}>
          Connection List
        </span>
        <div>
          {devices.map((d) => (
            <div key={d.id} style={styles.deviceItem}>
              <div style={styles.deviceName}>{d.name || "Unnamed Device"}</div>
              <div style={styles.deviceId}>{d.id}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <span style={{ color: "#ccc" }}>
          No contacts yet. Add friends to start messaging.
        </span>
      </div>

      {/* Scan Nearby Button */}
      <button style={styles.scanBtn} onClick={scanNearby}>
        Scan Nearby Devices
      </button>

      {/* Bottom Tabs */}
      <div style={styles.tabs}>
        <button style={styles.tabText}>Chat</button>
        <button style={styles.tabText}>Group</button>
        <button style={styles.tabText}>Call</button>
      </div>
    </div>
  );
}

// --- Inline CSS (like React Native StyleSheet) ---
const styles = {
  container: { display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#000" },
  header: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 15, backgroundColor: "#111" },
  profile: { display: "flex", flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: "50%", backgroundColor: "#25d366", marginRight: 10 },
  username: { color: "#fff", fontWeight: "bold" },
  qrBtn: { backgroundColor: "#25d366", padding: 5, borderRadius: 8 },
  threeDots: { padding: 5, borderRadius: 6, backgroundColor: "#222", color: "#fff" },
  connectionList: { backgroundColor: "#111", margin: 15, marginTop: 10, borderRadius: 8, padding: 10, flex: 1, overflow: "auto" },
  deviceItem: { padding: "8px 0", borderBottom: "1px solid #333" },
  deviceName: { color: "#fff", fontWeight: "bold" },
  deviceId: { color: "#ccc", fontSize: 12 },
  mainContent: { flex: 1, display: "flex", justifyContent: "center", alignItems: "center", marginTop: 10 },
  scanBtn: { backgroundColor: "#25d366", padding: 12, margin: 15, borderRadius: 8, color: "#fff", fontWeight: "bold" },
  tabs: { display: "flex", flexDirection: "row", justifyContent: "space-around", padding: 10, backgroundColor: "#111" },
  tabText: { color: "#fff", fontWeight: "bold", background: "transparent", border: "none" },
};

// Render
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
