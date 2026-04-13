"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreated = exports.sendPushNotification = exports.checkTaskExpiration = exports.processIdVerification = exports.submitReport = exports.adminCompleteWithdrawal = exports.createWithdrawalRequest = exports.confirmTaskCompletionAndSettlement = exports.submitTaskCompletion = exports.startTask = exports.acceptTask = exports.createTaskAndHoldFunds = exports.confirmTopUpAndCreditWallet = exports.createTopUpPaymentIntent = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe_1 = require("stripe");
admin.initializeApp();
const db = admin.firestore();
const stripe = new stripe_1.default('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', {
    apiVersion: '2024-04-10',
});
// 創建充值 PaymentIntent
exports.createTopUpPaymentIntent = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
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
    }
    catch (error) {
        console.error('Error creating payment intent:', error);
        throw new functions.https.HttpsError('internal', error.message || '無法創建付款');
    }
});
// 確認充值並入帳
exports.confirmTopUpAndCreditWallet = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    const { paymentIntentId } = data;
    const uid = context.auth.uid;
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            throw new functions.https.HttpsError('failed-precondition', '付款尚未完成');
        }
        const amount = paymentIntent.amount / 100; // 轉換回港幣
        await db.runTransaction(async (transaction) => {
            var _a;
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);
            const currentAvailable = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.walletAvailable) || 0;
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
    }
    catch (error) {
        console.error('Error confirming top up:', error);
        throw new functions.https.HttpsError('internal', error.message || '充值失敗');
    }
});
// 創建任務並凍結資金
exports.createTaskAndHoldFunds = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    const { taskData } = data;
    const uid = context.auth.uid;
    try {
        const result = await db.runTransaction(async (transaction) => {
            var _a, _b;
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);
            const availableBalance = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.walletAvailable) || 0;
            const requiredAmount = taskData.posterPayTotal;
            if (availableBalance < requiredAmount) {
                throw new functions.https.HttpsError('failed-precondition', '錢包餘額不足');
            }
            // 創建任務
            const taskRef = db.collection('tasks').doc();
            const taskId = taskRef.id;
            transaction.set(taskRef, Object.assign(Object.assign({}, taskData), { taskId: taskId, posterUid: uid, status: 'open', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            // 凍結資金
            transaction.update(userRef, {
                walletAvailable: availableBalance - requiredAmount,
                walletHeld: (((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.walletHeld) || 0) + requiredAmount,
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
    }
    catch (error) {
        console.error('Error creating task:', error);
        throw new functions.https.HttpsError('internal', error.message || '創建任務失敗');
    }
});
// 接單
exports.acceptTask = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    const { taskId } = data;
    const workerUid = context.auth.uid;
    try {
        const result = await db.runTransaction(async (transaction) => {
            var _a, _b, _c;
            const taskRef = db.collection('tasks').doc(taskId);
            const taskDoc = await transaction.get(taskRef);
            if (!taskDoc.exists) {
                throw new functions.https.HttpsError('not-found', '任務不存在');
            }
            if (((_a = taskDoc.data()) === null || _a === void 0 ? void 0 : _a.status) !== 'open') {
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
                posterUid: (_b = taskDoc.data()) === null || _b === void 0 ? void 0 : _b.posterUid,
                workerUid: workerUid,
                participants: [(_c = taskDoc.data()) === null || _c === void 0 ? void 0 : _c.posterUid, workerUid],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { chatId: chatRef.id };
        });
        return { success: true, chatId: result.chatId };
    }
    catch (error) {
        console.error('Error accepting task:', error);
        throw new functions.https.HttpsError('internal', error.message || '接單失敗');
    }
});
// 開始任務
exports.startTask = functions.region('asia-east2').https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    const { taskId } = data;
    const uid = context.auth.uid;
    try {
        const taskRef = db.collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) {
            throw new functions.https.HttpsError('not-found', '任務不存在');
        }
        if (((_a = taskDoc.data()) === null || _a === void 0 ? void 0 : _a.workerUid) !== uid) {
            throw new functions.https.HttpsError('permission-denied', '只有接單者可以開始任務');
        }
        if (((_b = taskDoc.data()) === null || _b === void 0 ? void 0 : _b.status) !== 'accepted') {
            throw new functions.https.HttpsError('failed-precondition', '任務狀態不正確');
        }
        await taskRef.update({
            status: 'in_progress',
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    }
    catch (error) {
        console.error('Error starting task:', error);
        throw new functions.https.HttpsError('internal', error.message || '開始任務失敗');
    }
});
// 提交任務完成
exports.submitTaskCompletion = functions.region('asia-east2').https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    const { taskId, receiptImages, actualPurchaseAmount } = data;
    const uid = context.auth.uid;
    try {
        const taskRef = db.collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) {
            throw new functions.https.HttpsError('not-found', '任務不存在');
        }
        if (((_a = taskDoc.data()) === null || _a === void 0 ? void 0 : _a.workerUid) !== uid) {
            throw new functions.https.HttpsError('permission-denied', '只有接單者可以提交完成');
        }
        if (((_b = taskDoc.data()) === null || _b === void 0 ? void 0 : _b.status) !== 'in_progress') {
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
    }
    catch (error) {
        console.error('Error submitting task completion:', error);
        throw new functions.https.HttpsError('internal', error.message || '提交完成失敗');
    }
});
// 確認任務完成並結算
exports.confirmTaskCompletionAndSettlement = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    const { taskId } = data;
    const uid = context.auth.uid;
    try {
        await db.runTransaction(async (transaction) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const taskRef = db.collection('tasks').doc(taskId);
            const taskDoc = await transaction.get(taskRef);
            if (!taskDoc.exists) {
                throw new functions.https.HttpsError('not-found', '任務不存在');
            }
            if (((_a = taskDoc.data()) === null || _a === void 0 ? void 0 : _a.posterUid) !== uid) {
                throw new functions.https.HttpsError('permission-denied', '只有發單者可以確認完成');
            }
            if (((_b = taskDoc.data()) === null || _b === void 0 ? void 0 : _b.status) !== 'pending_confirmation') {
                throw new functions.https.HttpsError('failed-precondition', '任務狀態不正確');
            }
            const taskData = taskDoc.data();
            const posterUid = taskData === null || taskData === void 0 ? void 0 : taskData.posterUid;
            const workerUid = taskData === null || taskData === void 0 ? void 0 : taskData.workerUid;
            const rewardAmount = (taskData === null || taskData === void 0 ? void 0 : taskData.rewardAmount) || 0;
            const workerFee = (taskData === null || taskData === void 0 ? void 0 : taskData.workerFee) || 0;
            const actualPurchaseAmount = (taskData === null || taskData === void 0 ? void 0 : taskData.actualPurchaseAmount) || 0;
            const estimatedPurchaseAmount = (taskData === null || taskData === void 0 ? void 0 : taskData.estimatedPurchaseAmount) || 0;
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
            const posterHeld = ((_c = posterDoc.data()) === null || _c === void 0 ? void 0 : _c.walletHeld) || 0;
            const posterAvailable = ((_d = posterDoc.data()) === null || _d === void 0 ? void 0 : _d.walletAvailable) || 0;
            transaction.update(posterRef, {
                walletHeld: posterHeld - (taskData === null || taskData === void 0 ? void 0 : taskData.posterPayTotal),
                walletAvailable: posterAvailable + purchaseRefund,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // 更新接單者錢包
            const workerRef = db.collection('users').doc(workerUid);
            const workerDoc = await transaction.get(workerRef);
            const workerWithdrawable = ((_e = workerDoc.data()) === null || _e === void 0 ? void 0 : _e.walletWithdrawable) || 0;
            const workerEarned = ((_f = workerDoc.data()) === null || _f === void 0 ? void 0 : _f.earnedTotal) || 0;
            const workerReimbursed = ((_g = workerDoc.data()) === null || _g === void 0 ? void 0 : _g.reimbursedTotal) || 0;
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
                amount: taskData === null || taskData === void 0 ? void 0 : taskData.posterPayTotal,
                direction: 'out',
                status: 'completed',
                title: '任務完成結算',
                description: `任務：${taskData === null || taskData === void 0 ? void 0 : taskData.title}`,
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
                description: `任務：${taskData === null || taskData === void 0 ? void 0 : taskData.title}`,
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
                    description: `任務：${taskData === null || taskData === void 0 ? void 0 : taskData.title}`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        return { success: true };
    }
    catch (error) {
        console.error('Error confirming task completion:', error);
        throw new functions.https.HttpsError('internal', error.message || '確認完成失敗');
    }
});
// 創建提款申請
exports.createWithdrawalRequest = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    const { amount, method, accountInfo } = data;
    const uid = context.auth.uid;
    try {
        const result = await db.runTransaction(async (transaction) => {
            var _a, _b;
            const userRef = db.collection('users').doc(uid);
            const userDoc = await transaction.get(userRef);
            const withdrawableBalance = ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.walletWithdrawable) || 0;
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
                walletHeld: (((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.walletHeld) || 0) + amount,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { withdrawRequestId: withdrawRef.id };
        });
        return { success: true, withdrawRequestId: result.withdrawRequestId };
    }
    catch (error) {
        console.error('Error creating withdrawal request:', error);
        throw new functions.https.HttpsError('internal', error.message || '創建提款申請失敗');
    }
});
// 後台完成提款
exports.adminCompleteWithdrawal = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    // TODO: 檢查是否為管理員
    // if (!isAdmin(context.auth.uid)) {
    //   throw new functions.https.HttpsError('permission-denied', '只有管理員可以處理提款');
    // }
    const { withdrawRequestId, status, processorNote } = data;
    try {
        await db.runTransaction(async (transaction) => {
            var _a, _b, _c, _d, _e, _f;
            const withdrawRef = db.collection('withdrawals').doc(withdrawRequestId);
            const withdrawDoc = await transaction.get(withdrawRef);
            if (!withdrawDoc.exists) {
                throw new functions.https.HttpsError('not-found', '提款申請不存在');
            }
            const userRef = db.collection('users').doc((_a = withdrawDoc.data()) === null || _a === void 0 ? void 0 : _a.uid);
            const userDoc = await transaction.get(userRef);
            // 更新提款狀態
            transaction.update(withdrawRef, {
                status: status,
                processedBy: context.auth.uid,
                processorNote: processorNote || null,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // 如果提款被拒絕，退還凍結資金
            if (status === 'rejected') {
                const heldAmount = ((_b = withdrawDoc.data()) === null || _b === void 0 ? void 0 : _b.amount) || 0;
                transaction.update(userRef, {
                    walletWithdrawable: (((_c = userDoc.data()) === null || _c === void 0 ? void 0 : _c.walletWithdrawable) || 0) + heldAmount,
                    walletHeld: (((_d = userDoc.data()) === null || _d === void 0 ? void 0 : _d.walletHeld) || 0) - heldAmount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            else if (status === 'completed') {
                // 如果提款完成，只減少凍結資金
                const heldAmount = ((_e = withdrawDoc.data()) === null || _e === void 0 ? void 0 : _e.amount) || 0;
                transaction.update(userRef, {
                    walletHeld: (((_f = userDoc.data()) === null || _f === void 0 ? void 0 : _f.walletHeld) || 0) - heldAmount,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });
        return { success: true };
    }
    catch (error) {
        console.error('Error processing withdrawal:', error);
        throw new functions.https.HttpsError('internal', error.message || '處理提款失敗');
    }
});
// 提交舉報
exports.submitReport = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
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
    }
    catch (error) {
        console.error('Error submitting report:', error);
        throw new functions.https.HttpsError('internal', error.message || '提交舉報失敗');
    }
});
// 處理身份證驗證
exports.processIdVerification = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
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
    }
    catch (error) {
        console.error('Error processing ID verification:', error);
        throw new functions.https.HttpsError('internal', error.message || '驗證失敗');
    }
});
// 檢查任務過期
exports.checkTaskExpiration = functions.region('asia-east2').pubsub.schedule('every 5 minutes').onRun(async (context) => {
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
            var _a, _b;
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
                walletAvailable: (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.walletAvailable) || 0) + taskData.posterPayTotal,
                walletHeld: (((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.walletHeld) || 0) - taskData.posterPayTotal,
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
            var _a, _b;
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
                walletAvailable: (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.walletAvailable) || 0) + taskData.posterPayTotal,
                walletHeld: (((_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.walletHeld) || 0) - taskData.posterPayTotal,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
    }
    console.log(`Processed ${immediateTasks.size} immediate and ${scheduledTasks.size} scheduled expired tasks`);
});
// 發送推送通知
exports.sendPushNotification = functions.region('asia-east2').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
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
    }
    catch (error) {
        console.error('Error sending push notification:', error);
        throw new functions.https.HttpsError('internal', error.message || '發送通知失敗');
    }
});
// 用戶創建時初始化
exports.onUserCreated = functions.region('asia-east2').auth.user().onCreate(async (user) => {
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
//# sourceMappingURL=index.js.map