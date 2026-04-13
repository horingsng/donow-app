import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocation } from '../contexts/LocationContext';

export default function HomeScreen() {
  const { location, isOnline, setIsOnline } = useLocation();

  useEffect(() => {
    // 可以在這裡處理位置更新或開始/停止在線狀態
    console.log('Current Location:', location);
    console.log('Is Online:', isOnline);
  }, [location, isOnline]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>首頁</Text>
        <Text style={styles.info}>呢度係首頁，顯示任務列表。</Text>
        {location ? (
          <Text style={styles.locationText}>你的位置: {location.coords.latitude}, {location.coords.longitude}</Text>
        ) : (
          <Text style={styles.locationText}>正在獲取位置...</Text>
        )}
        <Text style={styles.statusText}>目前狀態: {isOnline ? '✅ 在線' : '❌ 離線'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollView: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  info: { fontSize: 16, color: '#666' },
  locationText: { fontSize: 14, color: '#333', marginTop: 10 },
  statusText: { fontSize: 14, color: '#333', marginTop: 5 },
});