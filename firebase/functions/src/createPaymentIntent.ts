
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();
const db = admin.firestore();
const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
});

export const createPaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { amount, currency } = data;
  const uid = context.auth.uid;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount must be a positive number.');
  }
  if (!currency || typeof currency !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Currency must be a string.');
  }

  try {
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: { uid: uid }, // Link the PaymentIntent to the user
    });

    // Save pending transaction to Firestore
    await db.collection('transactions').add({
      uid: uid,
      amount: amount,
      currency: currency,
      paymentIntentId: paymentIntent.id,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error: any) {
    console.error('Error creating PaymentIntent:', error);
    throw new functions.https.HttpsError('internal', 'Unable to create PaymentIntent.', error.message);
  }
});
