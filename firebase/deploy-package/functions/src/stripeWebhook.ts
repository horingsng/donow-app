
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

admin.initializeApp();
const db = admin.firestore();
const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
});

export const stripeWebhook = functions.https.onRequest(async (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(request.rawBody, sig!, functions.config().stripe.webhook_secret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
      // Update user's wallet balance and transaction status
      await handlePaymentIntentSucceeded(paymentIntent);
      break;
    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`PaymentIntent for ${failedPaymentIntent.amount} failed!`);
      // Optionally handle failed payments (e.g., update transaction status)
      await handlePaymentIntentFailed(failedPaymentIntent);
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.json({ received: true });
});

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const uid = paymentIntent.metadata?.uid;
  const amount = paymentIntent.amount;
  const paymentIntentId = paymentIntent.id;

  if (!uid) {
    console.error('UID not found in PaymentIntent metadata.');
    return;
  }

  const transactionRef = db.collection('transactions').where('paymentIntentId', '==', paymentIntentId);
  const snapshot = await transactionRef.get();

  if (snapshot.empty) {
    console.error('No pending transaction found for PaymentIntent:', paymentIntentId);
    return;
  }

  const transactionDoc = snapshot.docs[0];
  await transactionDoc.ref.update({ status: 'succeeded', updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  // Update user's wallet balance
  const userRef = db.collection('users').doc(uid);
  await userRef.set(
    {
      walletBalance: admin.firestore.FieldValue.increment(amount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`User ${uid} wallet updated with ${amount}. Transaction ${paymentIntentId} succeeded.`);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const paymentIntentId = paymentIntent.id;

  const transactionRef = db.collection('transactions').where('paymentIntentId', '==', paymentIntentId);
  const snapshot = await transactionRef.get();

  if (snapshot.empty) {
    console.error('No pending transaction found for PaymentIntent:', paymentIntentId);
    return;
  }

  const transactionDoc = snapshot.docs[0];
  await transactionDoc.ref.update({ status: 'failed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });

  console.log(`Transaction ${paymentIntentId} marked as failed.`);
}
