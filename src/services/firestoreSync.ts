import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  getDoc,
  getDocs,
  getDocsFromServer,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  DentalOrder,
  DebtPaymentRecord,
  CashflowTransaction,
  DeliveryRecord,
  LabProfileConfig,
} from '../types/dental';

export async function clearUserCloudCollections(userId: string): Promise<void> {
  if (!userId) return;
  const colNames = ['orders', 'debtPayments', 'cashflows', 'deliveries'];
  for (const colName of colNames) {
    try {
      const q = query(collection(db, colName), where('ownerId', '==', userId));
      const snap = await getDocs(q);
      if (snap.empty) continue;
      let batch = writeBatch(db);
      let count = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref);
        count++;
        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, colName);
    }
  }
}

function sanitizeId(rawId: string): string {
  const clean = (rawId || 'doc_1').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return clean || 'doc_1';
}

function truncate(val: string | undefined, max: number): string {
  return (val || '').slice(0, max);
}

export async function syncOrderToFirestore(
  order: DentalOrder,
  isNew: boolean
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(order.id);
  const path = `orders/${docId}`;

  try {
    const docRef = doc(db, 'orders', docId);
    if (isNew) {
      await setDoc(docRef, {
        id: docId,
        ownerId: user.uid,
        warrantyCode: truncate(order.warrantyCode, 64),
        patientName: truncate(order.patientName, 200),
        phone: truncate(order.phone, 50),
        clinicName: truncate(order.clinicName, 250),
        clinicAddress: truncate(order.clinicAddress, 300),
        material: truncate(order.material, 150),
        warrantyPeriod: truncate(order.warrantyPeriod, 64),
        warrantyYears: Math.min(100, Math.max(0, Number(order.warrantyYears) || 15)),
        orderDate: truncate(order.orderDate, 32),
        monthYear: truncate(order.monthYear, 16),
        teeth: truncate(order.teeth, 200),
        teethCount: Math.min(64, Math.max(0, Number(order.teethCount) ?? 0)),
        toothForm: truncate(order.toothForm, 150),
        unitPrice: Math.max(0, Number(order.unitPrice) || 0),
        totalAmount: Math.max(0, Number(order.totalAmount) || 0),
        notes: truncate(order.notes, 1000),
        status: order.status ?? 'completed',
        paymentStatus: order.paymentStatus || 'unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingSnap = await getDoc(docRef);
      if (!existingSnap.exists()) {
        await syncOrderToFirestore(order, true);
        return;
      }
      await updateDoc(docRef, {
        warrantyCode: truncate(order.warrantyCode, 64),
        patientName: truncate(order.patientName, 200),
        phone: truncate(order.phone, 50),
        clinicName: truncate(order.clinicName, 250),
        clinicAddress: truncate(order.clinicAddress, 300),
        material: truncate(order.material, 150),
        warrantyPeriod: truncate(order.warrantyPeriod, 64),
        warrantyYears: Math.min(100, Math.max(0, Number(order.warrantyYears) || 15)),
        orderDate: truncate(order.orderDate, 32),
        monthYear: truncate(order.monthYear, 16),
        teeth: truncate(order.teeth, 200),
        teethCount: Math.min(64, Math.max(0, Number(order.teethCount) ?? 0)),
        toothForm: truncate(order.toothForm, 150),
        unitPrice: Math.max(0, Number(order.unitPrice) || 0),
        totalAmount: Math.max(0, Number(order.totalAmount) || 0),
        notes: truncate(order.notes, 1000),
        status: order.status ?? 'completed',
        paymentStatus: order.paymentStatus || 'unpaid',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteOrderFromFirestore(orderId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(orderId);
  const path = `orders/${docId}`;
  try {
    const docRef = doc(db, 'orders', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await deleteDoc(docRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncDebtPaymentToFirestore(
  payment: DebtPaymentRecord
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(payment.id);
  const path = `debtPayments/${docId}`;
  try {
    await setDoc(doc(db, 'debtPayments', docId), {
      id: docId,
      ownerId: user.uid,
      clinicName: truncate(payment.clinicName, 250),
      amount: Math.max(0, Number(payment.amount) || 0),
      paymentDate: truncate(payment.paymentDate, 32),
      monthYear: truncate(payment.monthYear, 16),
      method: payment.method === 'cash' ? 'cash' : 'transfer',
      notes: truncate(payment.notes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteDebtPaymentFromFirestore(paymentId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(paymentId);
  const path = `debtPayments/${docId}`;
  try {
    const docRef = doc(db, 'debtPayments', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await deleteDoc(docRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncCashflowToFirestore(
  tx: CashflowTransaction
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(tx.id);
  const path = `cashflows/${docId}`;
  try {
    await setDoc(doc(db, 'cashflows', docId), {
      id: docId,
      ownerId: user.uid,
      type: tx.type === 'expense' ? 'expense' : 'income',
      category: truncate(tx.category, 150),
      title: truncate(tx.title, 300),
      amount: Math.max(0, Number(tx.amount) || 0),
      date: truncate(tx.date, 32),
      monthYear: truncate(tx.monthYear, 16),
      clinicName: truncate(tx.clinicName, 250),
      paymentMethod: tx.paymentMethod ?? '',
      notes: truncate(tx.notes, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCashflowFromFirestore(txId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(txId);
  const path = `cashflows/${docId}`;
  try {
    const docRef = doc(db, 'cashflows', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await deleteDoc(docRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncDeliveryToFirestore(
  delivery: DeliveryRecord,
  isNew: boolean
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(delivery.id);
  const path = `deliveries/${docId}`;
  try {
    const docRef = doc(db, 'deliveries', docId);
    if (isNew) {
      await setDoc(docRef, {
        id: docId,
        ownerId: user.uid,
        warrantyCode: truncate(delivery.warrantyCode, 64),
        patientName: truncate(delivery.patientName, 200),
        clinicName: truncate(delivery.clinicName, 250),
        clinicAddress: truncate(delivery.clinicAddress, 300),
        deliveryDate: truncate(delivery.deliveryDate, 32),
        monthYear: truncate(delivery.monthYear, 16),
        direction: delivery.direction ?? '',
        courierName: truncate(delivery.courierName, 150),
        shippingFee: Math.max(0, Number(delivery.shippingFee) || 0),
        payer: delivery.payer ?? '',
        status: delivery.status ?? '',
        notes: truncate(delivery.notes, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        await syncDeliveryToFirestore(delivery, true);
        return;
      }
      await updateDoc(docRef, {
        warrantyCode: truncate(delivery.warrantyCode, 64),
        patientName: truncate(delivery.patientName, 200),
        clinicName: truncate(delivery.clinicName, 250),
        clinicAddress: truncate(delivery.clinicAddress, 300),
        deliveryDate: truncate(delivery.deliveryDate, 32),
        monthYear: truncate(delivery.monthYear, 16),
        direction: delivery.direction ?? '',
        courierName: truncate(delivery.courierName, 150),
        shippingFee: Math.max(0, Number(delivery.shippingFee) || 0),
        payer: delivery.payer ?? '',
        status: delivery.status ?? '',
        notes: truncate(delivery.notes, 500),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteDeliveryFromFirestore(deliveryId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(deliveryId);
  const path = `deliveries/${docId}`;
  try {
    const docRef = doc(db, 'deliveries', docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await deleteDoc(docRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncLabProfileToFirestore(
  profile: LabProfileConfig
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const docId = sanitizeId(`profile_${user.uid}`);
  const path = `settings/${docId}`;
  try {
    const docRef = doc(db, 'settings', docId);
    const snapshot = await getDocsFromServer(
      query(collection(db, 'settings'), where('ownerId', '==', user.uid))
    );
    if (!snapshot.docs.some((item) => item.id === docId)) {
      await setDoc(docRef, {
        id: docId,
        ownerId: user.uid,
        labName: truncate(profile.labName, 200),
        tagline: truncate(profile.tagline, 300),
        hotline: truncate(profile.hotline, 64),
        address: truncate(profile.address, 300),
        email: truncate(profile.email, 150),
        bankName: truncate(profile.bankName, 150),
        bankAccountNumber: truncate(profile.bankAccountNumber, 64),
        bankAccountHolder: truncate(profile.bankAccountHolder, 150),
        directorName: truncate(profile.directorName, 150),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        labName: truncate(profile.labName, 200),
        tagline: truncate(profile.tagline, 300),
        hotline: truncate(profile.hotline, 64),
        address: truncate(profile.address, 300),
        email: truncate(profile.email, 150),
        bankName: truncate(profile.bankName, 150),
        bankAccountNumber: truncate(profile.bankAccountNumber, 64),
        bankAccountHolder: truncate(profile.bankAccountHolder, 150),
        directorName: truncate(profile.directorName, 150),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserCloudData(
  userId: string,
  callbacks: {
    onError: () => void;
    onOrdersSnapshot: (cloudOrders: DentalOrder[]) => void;
    onPaymentsSnapshot: (cloudPayments: DebtPaymentRecord[]) => void;
    onCashflowsSnapshot: (cloudCashflows: CashflowTransaction[]) => void;
    onDeliveriesSnapshot: (cloudDeliveries: DeliveryRecord[]) => void;
    onProfileSnapshot: (cloudProfile: LabProfileConfig | null) => void;
  }
): () => void {
  const unsubOrders = onSnapshot(
    query(collection(db, 'orders'), where('ownerId', '==', userId)),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.fromCache) return;
      const list: DentalOrder[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          warrantyCode: data.warrantyCode,
          patientName: data.patientName,
          phone: data.phone,
          clinicName: data.clinicName,
          clinicAddress: data.clinicAddress,
          material: data.material,
          warrantyPeriod: data.warrantyPeriod,
          warrantyYears: data.warrantyYears,
          orderDate: data.orderDate,
          monthYear: data.monthYear,
          teeth: data.teeth,
          teethCount: data.teethCount,
          toothForm: data.toothForm,
          unitPrice: data.unitPrice,
          totalAmount: data.totalAmount,
          notes: data.notes,
          status: data.status,
          paymentStatus: data.paymentStatus,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
        };
      });
      callbacks.onOrdersSnapshot(list);
    },
    callbacks.onError
  );

  const unsubPayments = onSnapshot(
    query(collection(db, 'debtPayments'), where('ownerId', '==', userId)),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.fromCache) return;
      const list: DebtPaymentRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          clinicName: data.clinicName,
          amount: data.amount,
          paymentDate: data.paymentDate,
          monthYear: data.monthYear,
          method: data.method,
          notes: data.notes,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
        };
      });
      callbacks.onPaymentsSnapshot(list);
    },
    callbacks.onError
  );

  const unsubCashflows = onSnapshot(
    query(collection(db, 'cashflows'), where('ownerId', '==', userId)),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.fromCache) return;
      const list: CashflowTransaction[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          type: data.type,
          category: data.category,
          title: data.title,
          amount: data.amount,
          date: data.date,
          monthYear: data.monthYear,
          clinicName: data.clinicName,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
        };
      });
      callbacks.onCashflowsSnapshot(list);
    },
    callbacks.onError
  );

  const unsubDeliveries = onSnapshot(
    query(collection(db, 'deliveries'), where('ownerId', '==', userId)),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.fromCache) return;
      const list: DeliveryRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id,
          warrantyCode: data.warrantyCode,
          patientName: data.patientName,
          clinicName: data.clinicName,
          clinicAddress: data.clinicAddress,
          deliveryDate: data.deliveryDate,
          monthYear: data.monthYear,
          direction: data.direction,
          courierName: data.courierName,
          shippingFee: data.shippingFee,
          payer: data.payer,
          status: data.status,
          notes: data.notes,
          createdAt: data.createdAt?.toMillis?.() || Date.now(),
        };
      });
      callbacks.onDeliveriesSnapshot(list);
    },
    callbacks.onError
  );

  const unsubProfile = onSnapshot(
    query(collection(db, 'settings'), where('ownerId', '==', userId)),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.fromCache) return;
      if (!snap.empty) {
        const data = snap.docs[0].data();
        callbacks.onProfileSnapshot({
          labName: data.labName,
          tagline: data.tagline,
          hotline: data.hotline,
          address: data.address,
          email: data.email,
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
          bankAccountHolder: data.bankAccountHolder,
          directorName: data.directorName,
        });
      } else {
        callbacks.onProfileSnapshot(null);
      }
    },
    callbacks.onError
  );

  return () => {
    unsubOrders();
    unsubPayments();
    unsubCashflows();
    unsubDeliveries();
    unsubProfile();
  };
}
