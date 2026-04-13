import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db, storage } from '../services/firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

interface Message {
  id: string;
  senderUid: string;
  type: 'text' | 'image' | 'system';
  text?: string;
  imageUrl?: string;
  createdAt: any;
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { chatId, taskTitle, otherUserName } = route.params as { 
    chatId: string;
    taskTitle: string;
    otherUserName: string;
  };

  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'chat_messages'),
      where('chatId', '==', chatId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Message[];
      setMessages(msgs);
      setLoading(false);

      // 更新未讀數
      const chatRef = doc(db, 'chats', chatId);
      updateDoc(chatRef, { [`unreadCount.${currentUser.uid}`]: 0 });
    });

    return () => unsubscribe();
  }, [chatId, currentUser]);

  // 自動滾動到底部
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageInput.trim() || !currentUser) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'chat_messages'), {
        chatId,
        senderUid: currentUser.uid,
        type: 'text',
        text: messageInput.trim(),
        createdAt: serverTimestamp(),
      });

      // 更新聊天室最新訊息
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        const otherUid = chatData.members.find((uid: string) => uid !== currentUser.uid);
        
        updateDoc(chatRef, {
          lastMessage: messageInput.trim(),
          lastMessageType: 'text',
          lastSenderUid: currentUser.uid,
          [`unreadCount.${otherUid}`]: (chatData.unreadCount?.[otherUid] || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      }
      setMessageInput('');
    } catch (error) {
      Alert.alert('錯誤', '訊息發送失敗');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    if (!currentUser) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('權限不足', '需要相簿權限才能上傳圖片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      try {
        const imageUri = result.assets[0].uri;
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const filename = `chat_images/${chatId}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        
        await addDoc(collection(db, 'chat_messages'), {
          chatId,
          senderUid: currentUser.uid,
          type: 'image',
          imageUrl: downloadURL,
          createdAt: serverTimestamp(),
        });

        // 更新聊天室最新訊息
        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          const otherUid = chatData.members.find((uid: string) => uid !== currentUser.uid);
          
          updateDoc(chatRef, {
            lastMessage: '[圖片]',
            lastMessageType: 'image',
            lastSenderUid: currentUser.uid,
            [`unreadCount.${otherUid}`]: (chatData.unreadCount?.[otherUid] || 0) + 1,
            updatedAt: serverTimestamp(),
          });
        }

      } catch (error) {
        console.error('Upload chat image error:', error);
        Alert.alert('錯誤', '圖片上傳失敗');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.type === 'system') {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }

    const isMe = item.senderUid === currentUser?.uid;
    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {item.type === 'text' ? (
            <Text style={[styles.messageText, isMe ? styles.myText : styles.otherText]}>
              {item.text}
            </Text>
          ) : (
            <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
          )}
          <Text style={styles.messageTime}>{item.createdAt.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 頂部標題 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{taskTitle}</Text>
          <Text style={styles.headerSubtitle}>同 {otherUserName} 溝通中</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('更多選項', '功能開發中...')}>
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 訊息列表 */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* 輸入欄 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={pickImage} disabled={uploadingImage}>
            {uploadingImage ? (
              <ActivityIndicator color="#6366f1" />
            ) : (
              <Ionicons name="image-outline" size={24} color="#6366f1" />
            )}
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder="輸入訊息..."
            placeholderTextColor="#999"
            value={messageInput}
            onChangeText={setMessageInput}
            multiline
            maxHeight={100}
          />
          
          <TouchableOpacity 
            style={[styles.sendButton, (!messageInput.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!messageInput.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#6366f1',
    padding: 16,
    paddingTop: 12,
  },
  headerInfo: { alignItems: 'center', flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  messagesContainer: { padding: 16, flexGrow: 1 },
  messageContainer: { marginBottom: 12, flexDirection: 'row' },
  myMessage: { justifyContent: 'flex-end' },
  otherMessage: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '70%', padding: 12, borderRadius: 16 },
  myBubble: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  messageText: { fontSize: 15, lineHeight: 20 },
  myText: { color: '#fff' },
  otherText: { color: '#374151' },
  messageTime: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, alignSelf: 'flex-end' },
  messageImage: { width: 150, height: 150, borderRadius: 10, resizeMode: 'cover' },
  systemMessage: { alignItems: 'center', marginVertical: 8 },
  systemText: { fontSize: 12, color: '#9ca3af', backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  attachButton: { padding: 8 },
  input: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100, fontSize: 15 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonDisabled: { backgroundColor: '#a5b4fc' },
});