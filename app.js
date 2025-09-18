import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { NativeModules, NativeEventEmitter } from "react-native";

const { BluetoothModule } = NativeModules;
const btEvents = new NativeEventEmitter(BluetoothModule);

export default function App() {
  const [devices, setDevices] = useState([]);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [serverStarted, setServerStarted] = useState(false);

  useEffect(() => {
    requestPermissions();

    // Event listeners from native
    const foundSub = btEvents.addListener("onDeviceFound", (device) => {
      setDevices((prev) => {
        if (prev.find((d) => d.address === device.address)) return prev;
        return [...prev, device];
      });
    });

    const connSub = btEvents.addListener("onConnectionState", (state) => {
      if (state.state === "connected") {
        setConnected(true);
      } else if (state.state === "disconnected") {
        setConnected(false);
      }
    });

    const msgSub = btEvents.addListener("onMessageReceived", (msg) => {
      setMessages((prev) => [...prev, { from: msg.from, text: msg.message }]);
    });

    return () => {
      foundSub.remove();
      connSub.remove();
      msgSub.remove();
      BluetoothModule.destroy();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
    }
  };

  const scanNearby = async () => {
    setDevices([]);
    await BluetoothModule.startScan();
  };

  const connectToDevice = async (device) => {
    await BluetoothModule.connect(device.address);
  };

  const startServer = async () => {
    await BluetoothModule.startServer();
    setServerStarted(true);
  };

  const sendMessage = async () => {
    if (input.trim().length === 0) return;
    await BluetoothModule.sendMessage(input);
    setMessages((prev) => [...prev, { from: "Me", text: input }]);
    setInput("");
  };

  return (
    <SafeAreaView style={styles.container}>
      {!connected ? (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.btn} onPress={scanNearby}>
            <Text style={styles.btnText}>Scan Nearby Devices</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#ff9900" }]}
            onPress={startServer}
          >
            <Text style={styles.btnText}>
              {serverStarted ? "Server Running..." : "Start Server"}
            </Text>
          </TouchableOpacity>

          <FlatList
            data={devices}
            keyExtractor={(item) => item.address}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.deviceItem}
                onPress={() => connectToDevice(item)}
              >
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceId}>{item.address}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={{ color: "#888", marginTop: 20, textAlign: "center" }}>
                No devices found
              </Text>
            }
          />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }}>
          <FlatList
            data={messages}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <View style={styles.msgBubble}>
                <Text style={{ color: "#fff" }}>
                  {item.from}: {item.text}
                </Text>
              </View>
            )}
          />

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type message..."
              placeholderTextColor="#777"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Text style={{ color: "#fff" }}>Send</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 10 },
  btn: {
    backgroundColor: "#25d366",
    padding: 12,
    borderRadius: 8,
    marginVertical: 10,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "bold" },
  deviceItem: {
    padding: 12,
    borderBottomColor: "#333",
    borderBottomWidth: 1,
  },
  deviceName: { color: "#fff", fontWeight: "bold" },
  deviceId: { color: "#ccc", fontSize: 12 },
  msgBubble: {
    backgroundColor: "#333",
    marginVertical: 4,
    padding: 10,
    borderRadius: 6,
  },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    borderTopColor: "#333",
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    backgroundColor: "#111",
    color: "#fff",
    padding: 10,
    borderRadius: 6,
  },
  sendBtn: {
    backgroundColor: "#25d366",
    padding: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
});


