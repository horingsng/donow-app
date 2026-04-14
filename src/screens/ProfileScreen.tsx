import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getAuth, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../config/firebase'; // Assuming firebase config is here

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          console.log('No such document!');
        }
      });
      return () => unsubscribeFirestore();
    }
  }, [user]);

  const menuItems = [
    { icon: 'wallet-outline', title: '我的錢包', screen: 'Wallet' },
    { icon: 'list-outline', title: '我的任務', screen: 'MyTasks', badgeCount: userData?.pendingTasksCount || 0 },
    { icon: 'chatbubble-outline', title: '我的訊息', screen: 'ChatList', badgeCount: userData?.unreadMessagesCount || 0 },
    { icon: 'settings-outline', title: '設定', screen: null },
    { icon: 'help-circle-outline', title: '幫助中心', screen: null },
    { icon: 'document-text-outline', title: '服務條款', screen: null },
  ];

  const handleLogout = async () => {
    Alert.alert(
      '登出',
      '確定要登出？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '確定',
          onPress: async () => {
            try {
              await signOut(auth);
              // Navigate to login or home screen after logout
              navigation.replace('Login'); // Replace 'Login' with your actual login screen name
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('登出失敗', '請稍後再試。');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  const pickImage = async () => {
    if (!user) {
      Alert.alert('錯誤', '請先登入才能上傳頭像。');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      uploadImage(uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, `avatars/${user.uid}`);

    try {
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      // Update user profile in Firestore with the new avatar URL
      // (This would require a setDoc or updateDoc call to the user document)
      await updateDoc(userDocRef, { avatarUrl: downloadURL });
      Alert.alert('成功', '頭像上傳成功！');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('錯誤', '頭像上傳失敗，請稍後再試。');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text>載入中...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.userName}>請登入</Text>
          <Text style={styles.userEmail}>您需要登入才能查看個人資料。</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.replace('Login')} // Replace 'Login' with your actual login screen name
          >
            <Text style={styles.loginButtonText}>前往登入</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = userData?.name || user?.email?.split('@')[0] || '訪客';
  const displayEmail = userData?.email || user?.email || 'N/A';
  const avatarUrl = userData?.avatarUrl;
  const completedTasks = userData?.completedTasksCount || 0;
  const rating = userData?.rating || '5.0';
  const postedTasks = userData?.postedTasksCount || 0;
  const availableBalance = userData?.balance?.toFixed(2) || '0.00';


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 頂部用戶資料 */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.editButton} onPress={pickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>

          {/* 統計數據 */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{completedTasks}</Text>
              <Text style={styles.statLabel}>完成任務</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{rating}</Text>
              <Text style={styles.statLabel}>評分</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{postedTasks}</Text>
              <Text style={styles.statLabel}>發布任務</Text>
            </View>
          </View>
        </View>

        {/* 錢包總結卡片 */}
        <View style={styles.walletCard}>
            <View style={styles.walletHeader}>
                <Ionicons name="wallet-outline" size={24} color="#6366f1" />
                <Text style={styles.walletTitle}>我的錢包</Text>
            </View>
            <Text style={styles.walletBalance}>${availableBalance}</Text>
            <TouchableOpacity style={styles.walletButton} onPress={() => navigation.navigate('Wallet')}>
                <Text style={styles.walletButtonText}>查看詳情</Text>
                <Ionicons name="chevron-forward" size={18} color="#6366f1" />
            </TouchableOpacity>
        </View>

        {/* 菜單列表 */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={() => {
                if (item.screen) {
                  navigation.navigate(item.screen);
                } else {
                  Alert.alert(item.title, '功能開發中...');
                }
              }}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name={item.icon} size={22} color="#6366f1" />
              </View>
              <Text style={styles.menuText}>{item.title}</Text>
              {item.badgeCount && item.badgeCount > 0 && (
                  <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badgeCount}</Text>
                  </View>
              )}
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          ))}
        </View>

        {/* 登出按鈕 */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#6366f1',
    padding: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  loginButtonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    height: '100%',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  walletCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -40, // Overlap with header
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    marginBottom: 16,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginLeft: 8,
  },
  walletBalance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981', // Green for balance
    marginBottom: 15,
  },
  walletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ede9fe',
    paddingVertical: 10,
    borderRadius: 10,
  },
  walletButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    marginRight: 5,
  },
  menuSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  badge: {
    backgroundColor: '#ef4444', // Red badge
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 32,
  },
});