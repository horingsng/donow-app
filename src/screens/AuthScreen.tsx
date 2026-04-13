import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';

// Native Sign-In imports
let GoogleSignin: any;
let appleAuth: any;

try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch (e) {
  console.log('Google Sign-In not available');
}

try {
  appleAuth = require('@invertase/react-native-apple-authentication').default;
} catch (e) {
  console.log('Apple Sign-In not available');
}

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // Configure Google Sign-In
    if (GoogleSignin) {
      GoogleSignin.configure({
        webClientId: '1044613297121-ejbu6apdplrlacpn3e03chvh0u92g51r.apps.googleusercontent.com',
        iosClientId: '1044613297121-ejbu6apdplrlacpn3e03chvh0u92g51r.apps.googleusercontent.com',
      });
    }
  }, []);

  if (authLoading) {
    return <LoadingScreen message="檢查登入狀態..." />;
  }

  if (user) {
    navigation.navigate('Home' as never);
    return null;
  }

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('錯誤', '請輸入電郵同密碼');
      return;
    }
    
    setLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        Alert.alert('🎉 註冊成功', '歡迎使用即做！');
        setIsRegistering(false);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        navigation.navigate('Home' as never);
      }
    } catch (error: any) {
      let message = error.message;
      if (error.code === 'auth/user-not-found') message = '找不到呢個用戶';
      if (error.code === 'auth/wrong-password') message = '密碼錯誤';
      if (error.code === 'auth/email-already-in-use') message = '呢個電郵已被註冊';
      Alert.alert('❌ 登入失敗', message);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In (Native)
  const handleGoogleSignIn = async () => {
    if (!GoogleSignin) {
      Alert.alert('錯誤', 'Google 登入未安裝');
      return;
    }

    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      // Create Google credential
      const { idToken } = userInfo;
      const googleCredential = GoogleAuthProvider.credential(idToken);
      
      // Sign in with credential
      await signInWithCredential(auth, googleCredential);
      navigation.navigate('Home' as never);
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Alert.alert('❌ Google 登入失敗', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Apple Sign-In (Native)
  const handleAppleSignIn = async () => {
    if (!appleAuth) {
      Alert.alert('錯誤', 'Apple 登入未安裝');
      return;
    }

    setLoading(true);
    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      const { identityToken, nonce } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('Apple Sign-In failed - no identity token');
      }

      // Create Apple credential
      const appleCredential = OAuthProvider.credentialFromJSON({
        providerId: 'apple.com',
        idToken: identityToken,
        rawNonce: nonce,
      });

      // Sign in with credential
      await signInWithCredential(auth, appleCredential);
      navigation.navigate('Home' as never);
    } catch (error: any) {
      console.error('Apple Sign-In Error:', error);
      if (error.code !== appleAuth.Error.CANCELED) {
        Alert.alert('❌ Apple 登入失敗', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo 區域 */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>即</Text>
            </View>
            <Text style={styles.appName}>即做</Text>
            <Text style={styles.tagline}>搵人幫手，即刻做到</Text>
          </View>

          {/* 登入表單 */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>
              {isRegistering ? '創建新帳戶' : '登入帳戶'}
            </Text>

            {/* 電郵輸入 */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="電郵地址"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* 密碼輸入 */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="密碼"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {/* 主按鈕 */}
            <TouchableOpacity 
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isRegistering ? '註冊' : '登入'}
                </Text>
              )}
            </TouchableOpacity>

            {/* 切換模式 */}
            <TouchableOpacity 
              onPress={() => setIsRegistering(!isRegistering)}
              style={styles.switchContainer}
            >
              <Text style={styles.switchText}>
                {isRegistering ? '已有帳戶？' : '沒有帳戶？'}
              </Text>
              <Text style={styles.switchLink}>
                {isRegistering ? '立即登入' : '立即註冊'}
              </Text>
            </TouchableOpacity>

            {/* 分隔線 */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>或使用</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 社交登入按鈕 */}
            <View style={styles.socialContainer}>
              {/* Google 登入 */}
              <TouchableOpacity 
                style={[styles.socialButton, styles.googleButton]}
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                <View style={styles.googleIconContainer}>
                  <Text style={styles.googleIcon}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Google 登入</Text>
              </TouchableOpacity>

              {/* Apple 登入 */}
              <TouchableOpacity 
                style={[styles.socialButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-apple" size={20} color="#fff" />
                <Text style={styles.appleButtonText}>Apple 登入</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 底部版權 */}
          <Text style={styles.footer}>
            登入即表示你同意我們的服務條款
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  // Logo 區域
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#6b7280',
  },
  // 表單區域
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  // 輸入框
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  // 主按鈕
  primaryButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#a5b4fc',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // 切換模式
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchText: {
    color: '#6b7280',
    fontSize: 14,
  },
  switchLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  // 分隔線
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#9ca3af',
    marginHorizontal: 12,
    fontSize: 14,
  },
  // 社交登入
  socialContainer: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  // Google 按鈕
  googleButton: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '500',
  },
  // Apple 按鈕
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  // 底部
  footer: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 24,
  },
});