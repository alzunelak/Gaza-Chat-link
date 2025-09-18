// app.js — simple Web Bluetooth demo (module)
const scanBtn = document.getElementById('scanBtn');
const list = document.getElementById('deviceList');
const status = document.getElementById('status');

const devicesMap = new Map(); // address -> device info

function renderDevices() {
  if (devicesMap.size === 0) {
    list.innerHTML = `<div style="color:var(--muted)">No devices yet. Click “Scan Nearby”.</div>`;
    return;
  }
  list.innerHTML = '';
  for (const [id, info] of devicesMap) {
    const div = document.createElement('div');
    div.className = 'device';
    div.innerHTML = `
      <div class="name">${info.name || 'Unnamed device'}</div>
      <div class="id">${id}</div>
      <div style="margin-top:8px">
        <button data-id="${id}" class="connect">Connect</button>
        <button data-id="${id}" class="disconnect" style="margin-left:8px">Disconnect</button>
      </div>
      <div class="device-status" id="status-${id}" style="margin-top:8px;color:var(--muted)"></div>
    `;
    list.appendChild(div);
  }
  // attach handlers
  list.querySelectorAll('.connect').forEach(b => {
    b.onclick = async (e) => {
      const id = e.currentTarget.dataset.id;
      await connectDevice(id);
    };
  });
  list.querySelectorAll('.disconnect').forEach(b => {
    b.onclick = async (e) => {
      const id = e.currentTarget.dataset.id;
      await disconnectDevice(id);
    };
  });
}

// Helper: show status
function setStatus(txt) {
  status.textContent = txt || '';
}

// Start a user-initiated device chooser, add chosen device to list
async function startScan() {
  if (!navigator.bluetooth) {
    setStatus('Web Bluetooth API not supported in this browser.');
    return;
  }
  setStatus('Opening device chooser...');
  try {
    // Show system chooser. acceptAllDevices shows all devices; change if you need filters.
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['battery_service'] // optional
    });

    // Add to our map
    devicesMap.set(device.id, {
      id: device.id,
      name: device.name,
      device, // keep reference
      server: null,
      characteristics: {}
    });
    renderDevices();
    setStatus('Device selected — click Connect to connect.');
    
    // optional: listen for gattserverdisconnected event
    device.addEventListener('gattserverdisconnected', () => {
      const el = document.getElementById(`status-${device.id}`);
      if (el) el.textContent = 'Disconnected';
      setStatus(`Disconnected: ${device.name || device.id}`);
    });

  } catch (err) {
    console.error(err);
    setStatus('Chooser closed or error: ' + (err.message || err));
  }
}

// Connect to a device (GATT)
async function connectDevice(id) {
  const info = devicesMap.get(id);
  if (!info) { setStatus('Device not found'); return; }
  const device = info.device;
  setStatus(`Connecting to ${info.name || id}...`);
  try {
    const server = await device.gatt.connect();
    info.server = server;
    setStatus(`Connected to ${info.name || id}`);
    const el = document.getElementById(`status-${id}`);
    if (el) el.textContent = 'Connected';

    // Example: read battery level if service available
    try {
      const service = await server.getPrimaryService('battery_service');
      const char = await service.getCharacteristic('battery_level');
      const val = await char.readValue();
      const battery = val.getUint8(0);
      const s = document.getElementById(`status-${id}`);
      if (s) s.textContent = `Battery: ${battery}%`;
    } catch (e) {
      // battery not available — ignore
    }

  } catch (err) {
    console.error(err);
    setStatus('Connection failed: ' + (err.message || err));
    const el = document.getElementById(`status-${id}`);
    if (el) el.textContent = 'Connection failed';
  }
}

// Disconnect
async function disconnectDevice(id) {
  const info = devicesMap.get(id);
  if (!info) return;
  try {
    if (info.server && info.server.connected) {
      info.server.disconnect();
    } else if (info.device && info.device.gatt && info.device.gatt.connected) {
      info.device.gatt.disconnect();
    }
    setStatus(`Disconnected ${info.name || id}`);
    const el = document.getElementById(`status-${id}`);
    if (el) el.textContent = 'Disconnected';
  } catch (e) {
    console.error(e);
    setStatus('Error disconnecting: ' + (e.message || e));
  }
}

scanBtn.addEventListener('click', startScan);
renderDevices();
