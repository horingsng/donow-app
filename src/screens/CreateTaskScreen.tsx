import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db, storage } from '../services/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useWallet } from '../contexts/WalletContext';
import * as ImagePicker from 'expo-image-picker';

// 任務分類
const CATEGORIES = [
  { id: 'grocery', name: '代買', icon: 'cart-outline', color: '#22c55e' },
  { id: 'queueing', name: '排隊', icon: 'people-outline', color: '#f59e0b' },
  { id: 'delivery', name: '送遞', icon: 'bicycle-outline', color: '#3b82f6' },
  { id: 'pickup', name: '取件', icon: 'cube-outline', color: '#8b5cf6' },
  { id: 'instant_help', name: '即時幫手', icon: 'help-circle-outline', color: '#ef4444' },
];

// 香港地區
const DISTRICTS = [
  '中西區', '灣仔', '東區', '南區', '油尖旺', '深水埗', '九龍城', '黃大仙', '觀塘',
  '荃灣', '屯門', '元朗', '北區', '大埔', '沙田', '西貢', '離島',
];

export default function CreateTaskScreen() {
  const navigation = useNavigation();
  const { availableBalance, refreshWallet } = useWallet();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [subArea, setSubArea] = useState('');
  const [reward, setReward] = useState('');
  const [taskTimeType, setTaskTimeType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [purchaseRequired, setPurchaseRequired] = useState(false);
  const [estimatedPurchaseAmount, setEstimatedPurchaseAmount] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const rewardAmount = parseInt(reward) || 0;
  const posterFee = Math.ceil(rewardAmount * 0.1);
  const purchaseAmount = purchaseRequired ? (parseInt(estimatedPurchaseAmount) || 0) : 0;
  const totalPay = rewardAmount + posterFee + purchaseAmount;
  const hasEnoughBalance = availableBalance >= totalPay;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('權限不足', '需要相簿權限');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setUploadingImage(true);
      try {
        const user = auth.currentUser;
        if (!user) return;

        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const filename = `tasks/${user.uid}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        setImages([...images, downloadURL]);
      } catch (error) {
        Alert.alert('錯誤', '圖片上傳失敗');
      }
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim() || title.length < 5) {
      Alert.alert('錯誤', '標題至少 5 個字');
      return;
    }
    if (!description.trim() || description.length < 20) {
      Alert.alert('錯誤', '描述至少 20 個字');
      return;
    }
    if (!selectedCategory) {
      Alert.alert('錯誤', '請選擇分類');
      return;
    }
    if (!selectedDistrict) {
      Alert.alert('錯誤', '請選擇地區');
      return;
    }
    if (rewardAmount < 30) {
      Alert.alert('錯誤', '報酬最少 $30');
      return;
    }
    if (!hasEnoughBalance) {
      Alert.alert('餘額不足', `需要 $${totalPay}，但你只有 $${availableBalance}`);
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('請先登入');

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userName = userDoc.exists() ? userDoc.data().name || '用戶' : '用戶';

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw new Error('用戶資料不存在');

        const currentBalance = userSnap.data().walletAvailable || 0;
        if (currentBalance < totalPay) throw new Error('餘額不足');

        const taskRef = doc(collection(db, 'tasks'));
        transaction.set(taskRef, {
          taskId: taskRef.id,
          posterUid: user.uid,
          posterName: userName,
          title: title.trim(),
          description: description.trim(),
          category: selectedCategory,
          taskTimeType,
          rewardAmount,
          posterFee,
          workerFee: Math.ceil(rewardAmount * 0.1),
          posterPayTotal: totalPay,
          purchaseRequired,
          estimatedPurchaseAmount: purchaseAmount,
          actualPurchaseAmount: 0,
          purchaseBudgetHeld: purchaseAmount,
          district: selectedDistrict,
          subArea: subArea.trim() || selectedDistrict,
          status: 'open',
          images,
          viewCount: 0,
          applicationCount: 0,
          createdAt: serverTimestamp(),
          expiresAt: taskTimeType === 'immediate'
            ? new Date(Date.now() + 30 * 60 * 1000)
            : new Date(`${scheduledDate}T${scheduledTime}`),
        });

        transaction.update(userRef, {
          walletAvailable: currentBalance - totalPay,
          walletHeld: (userSnap.data().walletHeld || 0) + totalPay,
        });

        const transactionRef = doc(collection(db, 'wallet_transactions'));
        transaction.set(transactionRef, {
          transactionId: transactionRef.id,
          uid: user.uid,
          taskId: taskRef.id,
          type: 'task_payment_hold',
          amount: totalPay,
          direction: 'out',
          status: 'completed',
          title: '任務資金凍結',
          description: `任務：${title}`,
          createdAt: serverTimestamp(),
        });

        return taskRef.id;
      });

      Alert.alert('✅ 發布成功', '任務已成功發布！', [
        { text: '查看任務', onPress: () => navigation.navigate('Home') },
      ]);
      
      refreshWallet();
    } catch (error: any) {
      Alert.alert('❌ 發布失敗', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scrollView}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>發布任務</Text>
            <Text style={styles.headerSubtitle}>請填寫任務詳情</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基本資料</Text>
            <TextInput
              style={styles.input}
              placeholder="任務標題（例如：幫我買兩盒鮮奶）"
              value={title}
              onChangeText={setTitle}
              maxLength={50}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="任務描述（詳細說明要做咩、有咩要求）"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>任務圖片（可選）</Text>
            <View style={styles.imageSection}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.uploadedImage} />
                  <TouchableOpacity style={styles.removeImageButton} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity style={styles.addImageButton} onPress={pickImage} disabled={uploadingImage}>
                  {uploadingImage ? <ActivityIndicator color="#6366f1" /> : <>
                    <Ionicons name="camera-outline" size={32} color="#6366f1" />
                    <Text style={styles.addImageText}>添加圖片</Text>
                  </>}
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>任務分類 *</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryButton, selectedCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Ionicons name={cat.icon as any} size={24} color={selectedCategory === cat.id ? '#fff' : cat.color} />
                  <Text style={[styles.categoryText, selectedCategory === cat.id && { color: '#fff' }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>任務時間 *</Text>
            <View style={styles.timeTypeRow}>
              <TouchableOpacity style={[styles.timeTypeButton, taskTimeType === 'immediate' && styles.timeTypeButtonActive]} onPress={() => setTaskTimeType('immediate')}>
                <Ionicons name="flash-outline" size={20} color={taskTimeType === 'immediate' ? '#fff' : '#6366f1'} />
                <Text style={[styles.timeTypeText, taskTimeType === 'immediate' && styles.timeTypeTextActive]}>即時任務</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.timeTypeButton, taskTimeType === 'scheduled' && styles.timeTypeButtonActive]} onPress={() => setTaskTimeType('scheduled')}>
                <Ionicons name="calendar-outline" size={20} color={taskTimeType === 'scheduled' ? '#fff' : '#6366f1'} />
                <Text style={[styles.timeTypeText, taskTimeType === 'scheduled' && styles.timeTypeTextActive]}>預約任務</Text>
              </TouchableOpacity>
            </View>
            {taskTimeType === 'scheduled' && (
              <View style={styles.scheduledInputs}>
                <TextInput style={styles.input} placeholder="日期（YYYY-MM-DD）" value={scheduledDate} onChangeText={setScheduledDate} />
                <TextInput style={styles.input} placeholder="時間（HH:MM）" value={scheduledTime} onChangeText={setScheduledTime} />
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>任務地點 *</Text>
            <View style={styles.districtGrid}>
              {DISTRICTS.map((district) => (
                <TouchableOpacity key={district} style={[styles.districtButton, selectedDistrict === district && styles.districtButtonActive]} onPress={() => setSelectedDistrict(district)}>
                  <Text style={[styles.districtText, selectedDistrict === district && styles.districtTextActive]}>{district}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} placeholder="詳細位置（例如：朗豪坊附近）" value={subArea} onChangeText={setSubArea} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>報酬設定 *</Text>
            <View style={styles.rewardInput}>
              <Text style={styles.currency}>$</Text>
              <TextInput style={styles.rewardTextInput} placeholder="輸入報酬金額（最少$30）" value={reward} onChangeText={setReward} keyboardType="number-pad" maxLength={5} />
            </View>
            <TouchableOpacity style={styles.purchaseToggle} onPress={() => setPurchaseRequired(!purchaseRequired)}>
              <Ionicons name={purchaseRequired ? 'checkbox' : 'square-outline'} size={24} color="#6366f1" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, color: '#374151', fontWeight: '500' }}>需要代付購買物品</Text>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>例如：幫我買嘢，你先墊支</Text>
              </View>
            </TouchableOpacity>
            {purchaseRequired && (
              <View style={{ marginTop: 12, padding: 12, backgroundColor: '#fef3c7', borderRadius: 12 }}>
                <Text style={{ fontSize: 14, color: '#92400e', marginBottom: 8, fontWeight: '500' }}>預計代付金額</Text>
                <View style={styles.rewardInput}>
                  <Text style={styles.currency}>$</Text>
                  <TextInput style={styles.rewardTextInput} placeholder="輸入預計代付金額" value={estimatedPurchaseAmount} onChangeText={setEstimatedPurchaseAmount} keyboardType="number-pad" />
                </View>
                <Text style={{ fontSize: 13, color: '#f59e0b', marginTop: 8 }}>建議預留多10-20%作緩衝，實際金額可能會有差異</Text>
                <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>如代付金額不足，接單者可要求追加</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>費用明細</Text>
            <View style={styles.feeBreakdown}>
              <View style={styles.feeRow}><Text style={styles.feeLabel}>任務報酬</Text><Text style={styles.feeValue}>${rewardAmount}</Text></View>
              {purchaseRequired && purchaseAmount > 0 && <View style={styles.feeRow}><Text style={styles.feeLabel}>代付預算</Text><Text style={styles.feeValue}>${purchaseAmount}</Text></View>}
              <View style={styles.feeRow}><Text style={styles.feeLabel}>平台服務費（10%）</Text><Text style={styles.feeValue}>${posterFee}</Text></View>
              <View style={[styles.feeRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>合共需支付</Text>
                <Text style={styles.totalValue}>${totalPay}</Text>
              </View>
            </View>
            <View style={[styles.walletStatus, hasEnoughBalance ? styles.walletStatusOk : styles.walletStatusLow]}>
              <Ionicons name={hasEnoughBalance ? 'checkmark-circle' : 'warning'} size={20} color={hasEnoughBalance ? '#166534' : '#dc2626'} />
              <Text style={[styles.walletStatusText, hasEnoughBalance ? styles.walletStatusTextOk : styles.walletStatusTextLow]}>
                {hasEnoughBalance ? `可用餘額：$${availableBalance}（足夠支付）` : `可用餘額：$${availableBalance}（需充值 $${totalPay - availableBalance}）`}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.submitButton, (!hasEnoughBalance || loading) && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={!hasEnoughBalance || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>發布任務</Text>
            </>}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollView: { flex: 1 },
  header: { backgroundColor: '#6366f1', padding: 24, paddingTop: 16 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  section: { backgroundColor: '#fff', margin: 16, marginBottom: 8, padding: 16, borderRadius: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1f2937', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 16, color: '#1f2937', backgroundColor: '#f9fafb', marginBottom: 12 },
  textArea: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#9ca3af', textAlign: 'right' },
  imageSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  imageContainer: { position: 'relative' },
  uploadedImage: { width: 100, height: 100, borderRadius: 12 },
  removeImageButton: { position: 'absolute', top: -8, right: -8 },
  addImageButton: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  addImageText: { fontSize: 12, color: '#6366f1', marginTop: 4 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryButton: { width: '18%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  categoryText: { fontSize: 12, color: '#374151', marginTop: 4, fontWeight: '500' },
  timeTypeRow: { flexDirection: 'row', gap: 12 },
  timeTypeButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center' },
  timeTypeButtonActive: { backgroundColor: '#6366f1' },
  timeTypeText: { fontSize: 16, color: '#374151', fontWeight: '600', marginTop: 8 },
  timeTypeTextActive: { color: '#fff' },
  scheduledInputs: { marginTop: 12, gap: 12 },
  districtGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  districtButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6' },
  districtButtonActive: { backgroundColor: '#6366f1' },
  districtText: { fontSize: 13, color: '#374151' },
  districtTextActive: { color: '#fff', fontWeight: '500' },
  rewardInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', paddingHorizontal: 14 },
  currency: { fontSize: 20, fontWeight: 'bold', color: '#6366f1', marginRight: 8 },
  rewardTextInput: { flex: 1, paddingVertical: 14, fontSize: 18, color: '#1f2937' },
  purchaseToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 12 },
  feeBreakdown: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  feeLabel: { fontSize: 14, color: '#6b7280' },
  feeValue: { fontSize: 14, color: '#374151' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: '#1f2937' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#6366f1' },
  walletStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 16, padding: 12, borderRadius: 12, gap: 8 },
  walletStatusOk: { backgroundColor: '#dcfce7' },
  walletStatusLow: { backgroundColor: '#fee2e2' },
  walletStatusText: { fontSize: 14, fontWeight: '500' },
  walletStatusTextOk: { color: '#166534' },
  walletStatusTextLow: { color: '#dc2626' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', margin: 16, marginTop: 8, padding: 18, borderRadius: 12, gap: 8, elevation: 4, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  submitButtonDisabled: { backgroundColor: '#a5b4fc' },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  bottomPadding: { height: 32 },
});