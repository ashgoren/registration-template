import { logger } from 'firebase-functions/v2';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { validFields } from './fields.js';
import { createError, ErrorType } from './errorHandler.js';
const firestore = getFirestore();

const pendingCollection = firestore.collection('pendingOrders');
const ordersCollection = firestore.collection('orders');

export const savePendingOrder = async (order) => {
  logger.info(`SAVING PENDING ORDER: ${order.people[0].email}`, order);

  const filteredOrder = filterObject(order, validFields);
  const preppedOrder = {
    ...filteredOrder,
    createdAt: FieldValue.serverTimestamp(),
    paymentId: 'PENDING',
    status: 'pending'
  };

  try {
    const existingOrders = await pendingCollection.where('idempotencyKey', '==', order.idempotencyKey).get();
    if (existingOrders.empty) {
      await pendingCollection.add(preppedOrder);
    } else {
      await pendingCollection.doc(existingOrders.docs[0].id).set(preppedOrder);
    }
    logger.info(`PENDING ORDER SAVED: ${order.people[0].email}`);
  } catch (err) {
    throw createError(ErrorType.DATABASE_SAVE, 'Error saving pending order', { order, error: err });
  }
};

export const saveFinalOrder = async (order) => {
  logger.info(`SAVING FINAL ORDER: ${order.people[0].email}`, order);

  const filteredOrder = filterObject(order, validFields);
  const preppedOrder = {
    ...filteredOrder,
    createdAt: FieldValue.serverTimestamp(),
    status: 'final'
  };

  try {
    await ordersCollection.add(preppedOrder);
    logger.info(`FINAL ORDER SAVED: ${order.people[0].email}`);
  } catch (err) {
    throw createError(ErrorType.DATABASE_SAVE, 'Error saving final order', { order, error: err });
  }
};

// helper function to filter out any fields that aren't in the validFields array
const filterObject = (originalObj, validFields) => validFields.reduce((newObj, key) => {
  if (key in originalObj) {
    const value = originalObj[key];
    if (Array.isArray(value)) {
      newObj[key] = value.map(item => (item && typeof item === 'object') ? filterObject(item, validFields) : item);
    } else if (value && typeof value === 'object') {
      newObj[key] = filterObject(value, validFields);
    } else {
      newObj[key] = value;
    }
  }
  return newObj;
}, {});
