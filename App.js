App.js (React Native)

import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function App() {
  const [devices, setDevices] = useState([]);
  const manager = new BleManager();
  const [username, setUsername] = useState('User');

  // Load profile from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem('username').then(name => {
      if(name) setUsername(name);
    });
  }, []);

  // Scan Nearby Devices
  const scanNearby = () => {
    setDevices([]); // Clear previous
    manager.startDeviceScan(null, null, (error, device) => {
      if(error) return console.log('Scan error', error);
      if(device && !devices.find(d => d.id === device.id)) {
        setDevices(prev => [...prev, device]);
      }
    });
    setTimeout(() => manager.stopDeviceScan(), 5000); // Scan for 5s
  };

  // Render each device in list
  const renderDevice = ({item}) => (
    <View style={styles.deviceItem}>
      <Text style={styles.deviceName}>{item.name || 'Unnamed Device'}</Text>
      <Text style={styles.deviceId}>{item.id}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profile}>
          <View style={styles.avatar}></View>
          <Text style={styles.username}>{username}</Text>
        </View>
        <TouchableOpacity style={styles.qrBtn}><Text style={{color:'#000'}}>My QR</Text></TouchableOpacity>
        <TouchableOpacity style={styles.threeDots}><Text style={{color:'#fff'}}>⋮</Text></TouchableOpacity>
      </View>

      {/* Connection List Container */}
      <View style={styles.connectionList}>
        <Text style={{color:'#fff', fontWeight:'bold'}}>Connection List</Text>
        <FlatList
          data={devices}
          keyExtractor={item => item.id}
          renderItem={renderDevice}
        />
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Text style={{color:'#ccc'}}>No contacts yet. Add friends to start messaging.</Text>
      </View>

      {/* Scan Nearby Button (near bottom) */}
      <TouchableOpacity style={styles.scanBtn} onPress={scanNearby}>
        <Text style={{color:'#fff', fontWeight:'bold'}}>Scan Nearby Devices</Text>
      </TouchableOpacity>

      {/* Bottom Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity><Text style={styles.tabText}>Chat</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.tabText}>Group</Text></TouchableOpacity>
        <TouchableOpacity><Text style={styles.tabText}>Call</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1, backgroundColor:'#000'},
  header:{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:15, backgroundColor:'#111'},
  profile:{flexDirection:'row', alignItems:'center'},
  avatar:{width:40, height:40, borderRadius:20, backgroundColor:'#25d366', marginRight:10},
  username:{color:'#fff', fontWeight:'bold'},
  qrBtn:{backgroundColor:'#25d366', padding:5, borderRadius:8},
  threeDots:{padding:5, borderRadius:6},
  connectionList:{backgroundColor:'#111', marginHorizontal:15, marginTop:10, borderRadius:8, padding:10, flex:1},
  deviceItem:{paddingVertical:8, borderBottomColor:'#333', borderBottomWidth:1},
  deviceName:{color:'#fff', fontWeight:'bold'},
  deviceId:{color:'#ccc', fontSize:12},
  mainContent:{flex:1, justifyContent:'center', alignItems:'center', marginTop:10},
  scanBtn:{backgroundColor:'#25d366', padding:12, marginHorizontal:15, borderRadius:8, marginBottom:10},
  tabs:{flexDirection:'row', justifyContent:'space-around', padding:10, backgroundColor:'#111'},
  tabText:{color:'#fff', fontWeight:'bold'}
});

