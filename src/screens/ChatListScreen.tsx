import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../services/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';

export default function ChatListScreen() {
  const navigation = useNavigation();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const user = auth.currentUser;
    setCurrentUser(user);

    if (user) {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('members', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc')
      );

      const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
        const chatList = await Promise.all(
          snapshot.docs.map(async (chatDoc) => {
            const chatData = { id: chatDoc.id, ...chatDoc.data() };
            const otherUid = chatData.members.find((uid: string) => uid !== user.uid);

            let otherUserName = '用戶';
            if (otherUid) {
              const otherUserDoc = await getDoc(doc(db, 'users', otherUid));
              otherUserName = otherUserDoc.exists() ? otherUserDoc.data().name : '用戶';
            }
            
            // 獲取未讀訊息數
            const unreadCount = chatData.unreadCount?.[user.uid] || 0;

            return { 
              ...chatData, 
              otherUserName,
              unreadCount,
            };
          })
        );
        setChats(chatList);
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const renderChatItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => navigation.navigate('Chat', { chatId: item.id, taskTitle: item.taskTitle, otherUserName: item.otherUserName })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.otherUserName[0] || '?'}</Text>
      </View>
      
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.taskTitle}>{item.taskTitle}</Text>
          <Text style={styles.timeText}>{item.updatedAt?.toDate().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' }) || ''}</Text>
        </View>
        
        <View style={styles.chatRow}>
          <Text style={styles.userName}>{item.otherUserName}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage || ''}
          </Text>
        </View>
      </View>
      
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部標題 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的訊息</Text>
      </View>

      {/* 聊天列表 */}
      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>暫時沒有訊息</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    backgroundColor: '#6366f1',
    padding: 24,
    paddingTop: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  listContainer: { padding: 16 },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  chatInfo: { flex: 1 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  timeText: { fontSize: 12, color: '#9ca3af' },
  chatRow: { flexDirection: 'row', alignItems: 'center' },
  userName: { fontSize: 14, color: '#6366f1', fontWeight: '500', marginRight: 8 },
  lastMessage: { flex: 1, fontSize: 14, color: '#6b7280' },
  unreadBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 16 },
});