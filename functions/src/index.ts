import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();
const db = admin.firestore();

const stripe = new Stripe('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', {
  apiVersion: '2024-04-10',
});

// 創建充值 PaymentIntent
export const createTopUpPaymentIntent = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { amount } = data;
  const uid = context.auth.uid;
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // 轉換為 cents
      currency: 'hkd',
      metadata: {
        uid: uid,
        type: 'topup'
      }
    });
    
    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    };
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    throw new functions.https.HttpsError('internal', error.message || '無法創建付款');
  }
});

// 確認充值並入帳
export const confirmTopUpAndCreditWallet = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { paymentIntentId } = data;
  const uid = context.auth.uid;
  
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      throw new functions.https.HttpsError('failed-precondition', '付款尚未完成');
    }
    
    const amount = paymentIntent.amount / 100; // 轉換回港幣
    
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);
      
      const currentAvailable = userDoc.data()?.walletAvailable || 0;
      
      transaction.update(userRef, {
        walletAvailable: currentAvailable + amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 記錄交易
      const transactionRef = db.collection('wallet_transactions').doc();
      transaction.set(transactionRef, {
        uid: uid,
        type: 'top_up',
        amount: amount,
        direction: 'in',
        status: 'completed',
        title: '充值',
        description: `Stripe 充值 ${amount} HKD`,
        metadata: {
          paymentIntentId: paymentIntentId,
          stripePaymentId: paymentIntent.id
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    return { success: true, amount: amount };
  } catch (error: any) {
    console.error('Error confirming top up:', error);
    throw new functions.https.HttpsError('internal', error.message || '充值失敗');
  }
});

// 創建任務並凍結資金
export const createTaskAndHoldFunds = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { taskData } = data;
  const uid = context.auth.uid;
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);
      
      const availableBalance = userDoc.data()?.walletAvailable || 0;
      const requiredAmount = taskData.posterPayTotal;
      
      if (availableBalance < requiredAmount) {
        throw new functions.https.HttpsError('failed-precondition', '錢包餘額不足');
      }
      
      // 創建任務
      const taskRef = db.collection('tasks').doc();
      const taskId = taskRef.id;
      
      transaction.set(taskRef, {
        ...taskData,
        taskId: taskId,
        posterUid: uid,
        status: 'open',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 凍結資金
      transaction.update(userRef, {
        walletAvailable: availableBalance - requiredAmount,
        walletHeld: (userDoc.data()?.walletHeld || 0) + requiredAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 記錄交易
      const transactionRef = db.collection('wallet_transactions').doc();
      transaction.set(transactionRef, {
        uid: uid,
        taskId: taskId,
        type: 'task_payment_hold',
        amount: requiredAmount,
        direction: 'out',
        status: 'completed',
        title: '任務資金凍結',
        description: `任務：${taskData.title}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { taskId: taskId };
    });
    
    return { success: true, taskId: result.taskId };
  } catch (error: any) {
    console.error('Error creating task:', error);
    throw new functions.https.HttpsError('internal', error.message || '創建任務失敗');
  }
});

// 接單
export const acceptTask = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { taskId } = data;
  const workerUid = context.auth.uid;
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const taskRef = db.collection('tasks').doc(taskId);
      const taskDoc = await transaction.get(taskRef);
      
      if (!taskDoc.exists) {
        throw new functions.https.HttpsError('not-found', '任務不存在');
      }
      
      if (taskDoc.data()?.status !== 'open') {
        throw new functions.https.HttpsError('failed-precondition', '任務已被接取');
      }
      
      // 更新任務狀態
      transaction.update(taskRef, {
        workerUid: workerUid,
        status: 'accepted',
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 創建聊天室
      const chatRef = db.collection('chats').doc();
      transaction.set(chatRef, {
        chatId: chatRef.id,
        taskId: taskId,
        posterUid: taskDoc.data()?.posterUid,
        workerUid: workerUid,
        participants: [taskDoc.data()?.posterUid, workerUid],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { chatId: chatRef.id };
    });
    
    return { success: true, chatId: result.chatId };
  } catch (error: any) {
    console.error('Error accepting task:', error);
    throw new functions.https.HttpsError('internal', error.message || '接單失敗');
  }
});

// 開始任務
export const startTask = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { taskId } = data;
  const uid = context.auth.uid;
  
  try {
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      throw new functions.https.HttpsError('not-found', '任務不存在');
    }
    
    if (taskDoc.data()?.workerUid !== uid) {
      throw new functions.https.HttpsError('permission-denied', '只有接單者可以開始任務');
    }
    
    if (taskDoc.data()?.status !== 'accepted') {
      throw new functions.https.HttpsError('failed-precondition', '任務狀態不正確');
    }
    
    await taskRef.update({
      status: 'in_progress',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error starting task:', error);
    throw new functions.https.HttpsError('internal', error.message || '開始任務失敗');
  }
});

// 提交任務完成
export const submitTaskCompletion = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { taskId, receiptImages, actualPurchaseAmount } = data;
  const uid = context.auth.uid;
  
  try {
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
      throw new functions.https.HttpsError('not-found', '任務不存在');
    }
    
    if (taskDoc.data()?.workerUid !== uid) {
      throw new functions.https.HttpsError('permission-denied', '只有接單者可以提交完成');
    }
    
    if (taskDoc.data()?.status !== 'in_progress') {
      throw new functions.https.HttpsError('failed-precondition', '任務狀態不正確');
    }
    
    await taskRef.update({
      status: 'pending_confirmation',
      receiptImages: receiptImages || [],
      actualPurchaseAmount: actualPurchaseAmount || 0,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error submitting task completion:', error);
    throw new functions.https.HttpsError('internal', error.message || '提交完成失敗');
  }
});

// 確認任務完成並結算
export const confirmTaskCompletionAndSettlement = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { taskId } = data;
  const uid = context.auth.uid;
  
  try {
    await db.runTransaction(async (transaction) => {
      const taskRef = db.collection('tasks').doc(taskId);
      const taskDoc = await transaction.get(taskRef);
      
      if (!taskDoc.exists) {
        throw new functions.https.HttpsError('not-found', '任務不存在');
      }
      
      if (taskDoc.data()?.posterUid !== uid) {
        throw new functions.https.HttpsError('permission-denied', '只有發單者可以確認完成');
      }
      
      if (taskDoc.data()?.status !== 'pending_confirmation') {
        throw new functions.https.HttpsError('failed-precondition', '任務狀態不正確');
      }
      
      const taskData = taskDoc.data();
      const posterUid = taskData?.posterUid;
      const workerUid = taskData?.workerUid;
      const rewardAmount = taskData?.rewardAmount || 0;
      const workerFee = taskData?.workerFee || 0;
      const actualPurchaseAmount = taskData?.actualPurchaseAmount || 0;
      const estimatedPurchaseAmount = taskData?.estimatedPurchaseAmount || 0;
      const purchaseRefund = estimatedPurchaseAmount - actualPurchaseAmount;
      
      const workerNet = rewardAmount - workerFee;
      
      // 更新任務狀態
      transaction.update(taskRef, {
        status: 'completed',
        settledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 更新發單者錢包
      const posterRef = db.collection('users').doc(posterUid);
      const posterDoc = await transaction.get(posterRef);
      const posterHeld = posterDoc.data()?.walletHeld || 0;
      const posterAvailable = posterDoc.data()?.walletAvailable || 0;
      
      transaction.update(posterRef, {
        walletHeld: posterHeld - taskData?.posterPayTotal,
        walletAvailable: posterAvailable + purchaseRefund,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 更新接單者錢包
      const workerRef = db.collection('users').doc(workerUid);
      const workerDoc = await transaction.get(workerRef);
      const workerWithdrawable = workerDoc.data()?.walletWithdrawable || 0;
      const workerEarned = workerDoc.data()?.earnedTotal || 0;
      const workerReimbursed = workerDoc.data()?.reimbursedTotal || 0;
      
      transaction.update(workerRef, {
        walletWithdrawable: workerWithdrawable + workerNet + actualPurchaseAmount,
        earnedTotal: workerEarned + workerNet,
        reimbursedTotal: workerReimbursed + actualPurchaseAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 記錄發單者交易
      const posterTxRef = db.collection('wallet_transactions').doc();
      transaction.set(posterTxRef, {
        uid: posterUid,
        taskId: taskId,
        type: 'task_payment_release',
        amount: taskData?.posterPayTotal,
        direction: 'out',
        status: 'completed',
        title: '任務完成結算',
        description: `任務：${taskData?.title}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 記錄接單者交易
      const workerTxRef = db.collection('wallet_transactions').doc();
      transaction.set(workerTxRef, {
        uid: workerUid,
        taskId: taskId,
        type: 'task_payment_release',
        amount: workerNet,
        direction: 'in',
        status: 'completed',
        title: '任務收入',
        description: `任務：${taskData?.title}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 如果有代付報銷
      if (actualPurchaseAmount > 0) {
        const reimburseRef = db.collection('wallet_transactions').doc();
        transaction.set(reimburseRef, {
          uid: workerUid,
          taskId: taskId,
          type: 'purchase_reimbursement',
          amount: actualPurchaseAmount,
          direction: 'in',
          status: 'completed',
          title: '代付報銷',
          description: `任務：${taskData?.title}`,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error confirming task completion:', error);
    throw new functions.https.HttpsError('internal', error.message || '確認完成失敗');
  }
});

// 創建提款申請
export const createWithdrawalRequest = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { amount, method, accountInfo } = data;
  const uid = context.auth.uid;
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);
      
      const withdrawableBalance = userDoc.data()?.walletWithdrawable || 0;
      
      if (withdrawableBalance < amount) {
        throw new functions.https.HttpsError('failed-precondition', '可提款餘額不足');
      }
      
      // 創建提款申請
      const withdrawRef = db.collection('withdrawals').doc();
      transaction.set(withdrawRef, {
        withdrawRequestId: withdrawRef.id,
        uid: uid,
        amount: amount,
        method: method,
        accountInfo: accountInfo,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 凍結提款金額
      transaction.update(userRef, {
        walletWithdrawable: withdrawableBalance - amount,
        walletHeld: (userDoc.data()?.walletHeld || 0) + amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { withdrawRequestId: withdrawRef.id };
    });
    
    return { success: true, withdrawRequestId: result.withdrawRequestId };
  } catch (error: any) {
    console.error('Error creating withdrawal request:', error);
    throw new functions.https.HttpsError('internal', error.message || '創建提款申請失敗');
  }
});

// 後台完成提款
export const adminCompleteWithdrawal = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  // TODO: 檢查是否為管理員
  // if (!isAdmin(context.auth.uid)) {
  //   throw new functions.https.HttpsError('permission-denied', '只有管理員可以處理提款');
  // }
  
  const { withdrawRequestId, status, processorNote } = data;
  
  try {
    await db.runTransaction(async (transaction) => {
      const withdrawRef = db.collection('withdrawals').doc(withdrawRequestId);
      const withdrawDoc = await transaction.get(withdrawRef);
      
      if (!withdrawDoc.exists) {
        throw new functions.https.HttpsError('not-found', '提款申請不存在');
      }
      
      const userRef = db.collection('users').doc(withdrawDoc.data()?.uid);
      const userDoc = await transaction.get(userRef);
      
      // 更新提款狀態
      transaction.update(withdrawRef, {
        status: status,
        processedBy: context.auth!.uid,
        processorNote: processorNote || null,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      // 如果提款被拒絕，退還凍結資金
      if (status === 'rejected') {
        const heldAmount = withdrawDoc.data()?.amount || 0;
        transaction.update(userRef, {
          walletWithdrawable: (userDoc.data()?.walletWithdrawable || 0) + heldAmount,
          walletHeld: (userDoc.data()?.walletHeld || 0) - heldAmount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else if (status === 'completed') {
        // 如果提款完成，只減少凍結資金
        const heldAmount = withdrawDoc.data()?.amount || 0;
        transaction.update(userRef, {
          walletHeld: (userDoc.data()?.walletHeld || 0) - heldAmount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('Error processing withdrawal:', error);
    throw new functions.https.HttpsError('internal', error.message || '處理提款失敗');
  }
});

// 提交舉報
export const submitReport = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { targetType, targetId, reason, description, evidenceImages } = data;
  const uid = context.auth.uid;
  
  try {
    const reportRef = db.collection('reports').doc();
    await reportRef.set({
      reportId: reportRef.id,
      reporterUid: uid,
      targetType: targetType,
      targetId: targetId,
      reason: reason,
      description: description,
      evidenceImages: evidenceImages || [],
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, reportId: reportRef.id };
  } catch (error: any) {
    console.error('Error submitting report:', error);
    throw new functions.https.HttpsError('internal', error.message || '提交舉報失敗');
  }
});

// 處理身份證驗證
export const processIdVerification = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  // const { idCardFrontUrl, idCardBackUrl, selfieUrl } = data;
    const idCardFrontUrl = data.idCardFrontUrl;
    const idCardBackUrl = data.idCardBackUrl;
    const selfieUrl = data.selfieUrl;
    console.log("Processing ID verification for URLs:", idCardFrontUrl, idCardBackUrl, selfieUrl);
  const uid = context.auth.uid;
  
  try {
    // TODO: 使用 Google Cloud Vision API 進行 OCR
    // TODO: 使用 Face++ 或 AWS Rekognition 進行人臉比對
    // TODO: 檢查年齡是否 >= 16
    
    // 暫時直接標記為已驗證（測試用）
    await db.collection('users').doc(uid).update({
      idVerificationStatus: 'verified',
      isVerified: true,
      idVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, status: 'verified' };
  } catch (error: any) {
    console.error('Error processing ID verification:', error);
    throw new functions.https.HttpsError('internal', error.message || '驗證失敗');
  }
});

// 檢查任務過期
export const checkTaskExpiration = functions.region('asia-east2').pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  
  // 檢查即時任務（30分鐘無人接自動過期）
  const immediateDeadline = new Date(now.toMillis() - 30 * 60 * 1000);
  const immediateTasks = await db.collection('tasks')
    .where('taskTimeType', '==', 'immediate')
    .where('status', '==', 'open')
    .where('createdAt', '<', immediateDeadline)
    .get();
  
  for (const doc of immediateTasks.docs) {
    await db.runTransaction(async (transaction) => {
      const taskRef = db.collection('tasks').doc(doc.id);
      const taskData = doc.data();
      
      transaction.update(taskRef, {
        status: 'expired',
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 退還凍結資金
      const userRef = db.collection('users').doc(taskData.posterUid);
      const userDoc = await transaction.get(userRef);
      
      transaction.update(userRef, {
        walletAvailable: (userDoc.data()?.walletAvailable || 0) + taskData.posterPayTotal,
        walletHeld: (userDoc.data()?.walletHeld || 0) - taskData.posterPayTotal,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  }
  
  // 檢查預約任務（預約時間前2小時無人接自動過期）
  const scheduledDeadline = new Date(now.toMillis() + 2 * 60 * 60 * 1000);
  const scheduledTasks = await db.collection('tasks')
    .where('taskTimeType', '==', 'scheduled')
    .where('status', '==', 'open')
    .where('scheduledStartAt', '<', scheduledDeadline)
    .get();
  
  for (const doc of scheduledTasks.docs) {
    await db.runTransaction(async (transaction) => {
      const taskRef = db.collection('tasks').doc(doc.id);
      const taskData = doc.data();
      
      transaction.update(taskRef, {
        status: 'expired',
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 退還凍結資金
      const userRef = db.collection('users').doc(taskData.posterUid);
      const userDoc = await transaction.get(userRef);
      
      transaction.update(userRef, {
        walletAvailable: (userDoc.data()?.walletAvailable || 0) + taskData.posterPayTotal,
        walletHeld: (userDoc.data()?.walletHeld || 0) - taskData.posterPayTotal,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  }
  
  console.log(`Processed ${immediateTasks.size} immediate and ${scheduledTasks.size} scheduled expired tasks`);
});

// 發送推送通知
export const sendPushNotification = functions.region('asia-east2').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '請先登入');
  
  const { token, title, body, data: payloadData } = data;
  
  try {
    const message = {
      notification: {
        title: title,
        body: body
      },
      data: payloadData || {},
      token: token
    };
    
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    
    return { success: true, messageId: response };
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    throw new functions.https.HttpsError('internal', error.message || '發送通知失敗');
  }
});

// 用戶創建時初始化
export const onUserCreated = functions.region('asia-east2').auth.user().onCreate(async (user) => {
  const uid = user.uid;
  
  await db.collection('users').doc(uid).set({
    uid: uid,
    name: user.displayName || '用戶',
    photoUrl: user.photoURL || null,
    email: user.email || null,
    walletAvailable: 0,
    walletHeld: 0,
    walletWithdrawable: 0,
    earnedTotal: 0,
    reimbursedTotal: 0,
    isVerified: false,
    idVerificationStatus: 'unverified',
    riskAcknowledged: false,
    consentSigned: false,
    isOnlineForPush: false,
    pushRadiusKm: 2,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  console.log(`User ${uid} initialized`);
});
