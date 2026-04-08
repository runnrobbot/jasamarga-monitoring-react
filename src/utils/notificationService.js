import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocs,
  query,
  where,
  getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';


export const addNotification = async (userId, type, title, message, relatedData = {}) => {
  try {
    const notificationData = {
      uid: userId,
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: serverTimestamp(),
      relatedData,
      priority: relatedData.priority || 'medium',
      targetRoles: 'user'
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

/**
 * ✅ Create announcement for admin & pic roles
 */
export const createAnnouncement = async (createdBy, title, message, targetRoles = 'all', priority = 'medium') => {
  try {
    const announcementData = {
      uid: 'system',
      userId: 'system',
      createdBy,
      type: 'announcement',
      title,
      message,
      read: false,
      createdAt: serverTimestamp(),
      targetRoles,
      priority,
      relatedData: {
        isAnnouncement: true,
        createdBy
      }
    };

    const docRef = await addDoc(collection(db, 'notifications'), announcementData);
    return docRef.id;
  } catch (error) {
    throw error;
  }
};

/**
 * ✅ Mark notification as read
 */
export const markAsRead = async (notificationId) => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    throw error;
  }
};

/**
 * ✅ Delete a notification
 */
export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    throw error;
  }
};

/**
 * ✅ Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userRole = userDoc.data()?.role;

    const q1 = query(
      collection(db, 'notifications'),
      where('uid', '==', userId),
      where('read', '==', false)
    );

    const q2 = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const q3 = query(
      collection(db, 'notifications'),
      where('uid', '==', 'system'),
      where('targetRoles', '==', 'all'),
      where('read', '==', false)
    );

    const q4 = query(
      collection(db, 'notifications'),
      where('uid', '==', 'system'),
      where('targetRoles', '==', userRole),
      where('read', '==', false)
    );

    const [snap1, snap2, snap3, snap4] = await Promise.all([
      getDocs(q1),
      getDocs(q2),
      getDocs(q3),
      getDocs(q4)
    ]);

    const docIds = new Set();
    [snap1, snap2, snap3, snap4].forEach(snapshot => {
      snapshot.docs.forEach(doc => docIds.add(doc.id));
    });

    if (docIds.size === 0) {
      console.log('No unread notifications to mark');
      return 0;
    }

    const updatePromises = Array.from(docIds).map(docId => 
      updateDoc(doc(db, 'notifications', docId), {
        read: true,
        readAt: serverTimestamp()
      })
    );

    await Promise.all(updatePromises);
    return updatePromises.length;
  } catch (error) {
    throw error;
  }
};

/**
 * ✅ Delete all read notifications for a user
 */
export const deleteAllRead = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userRole = userDoc.data()?.role;

    const q1 = query(
      collection(db, 'notifications'),
      where('uid', '==', userId),
      where('read', '==', true)
    );

    const q2 = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', true)
    );

    const q3 = query(
      collection(db, 'notifications'),
      where('uid', '==', 'system'),
      where('targetRoles', '==', 'all'),
      where('read', '==', true)
    );

    const q4 = query(
      collection(db, 'notifications'),
      where('uid', '==', 'system'),
      where('targetRoles', '==', userRole),
      where('read', '==', true)
    );

    const [snap1, snap2, snap3, snap4] = await Promise.all([
      getDocs(q1),
      getDocs(q2),
      getDocs(q3),
      getDocs(q4)
    ]);

    const docIds = new Set();
    [snap1, snap2, snap3, snap4].forEach(snapshot => {
      snapshot.docs.forEach(doc => docIds.add(doc.id));
    });

    if (docIds.size === 0) {
      console.log('No read notifications to delete');
      return 0;
    }

    const deletePromises = Array.from(docIds).map(docId => 
      deleteDoc(doc(db, 'notifications', docId))
    );

    await Promise.all(deletePromises);
    console.log(`🗑️ Deleted ${deletePromises.length} read notifications`);
    return deletePromises.length;
  } catch (error) {
    console.error('❌ Error deleting read notifications:', error);
    throw error;
  }
};

/**
 * ✅ Notification templates for admin & pic
 */
export const NotificationTemplates = {
  KOMITMEN_CREATED: (namaPaket) => ({
    type: 'success',
    title: 'Komitmen Baru Ditambahkan',
    message: `Komitmen "${namaPaket}" telah berhasil ditambahkan ke sistem.`,
    priority: 'medium'
  }),

  KOMITMEN_UPDATED: (namaPaket) => ({
    type: 'info',
    title: 'Komitmen Diperbarui',
    message: `Komitmen "${namaPaket}" telah diperbarui.`,
    priority: 'low'
  }),

  KOMITMEN_DELETED: (namaPaket) => ({
    type: 'warning',
    title: 'Komitmen Dihapus',
    message: `Komitmen "${namaPaket}" telah dihapus dari sistem.`,
    priority: 'medium'
  }),

  USER_REGISTERED: (namaUser) => ({
    type: 'success',
    title: 'Selamat Datang!',
    message: `Halo ${namaUser}, akun Anda telah berhasil dibuat. Silakan login untuk memulai.`,
    priority: 'high'
  }),

  USER_ACTIVATED: (namaUser) => ({
    type: 'success',
    title: 'Akun Diaktifkan',
    message: `Akun ${namaUser} telah diaktifkan oleh admin.`,
    priority: 'high'
  }),

  USER_DEACTIVATED: (namaUser) => ({
    type: 'error',
    title: 'Akun Dinonaktifkan',
    message: `Akun ${namaUser} telah dinonaktifkan oleh admin.`,
    priority: 'high'
  }),

  REPORT_GENERATED: (reportType) => ({
    type: 'info',
    title: 'Laporan Siap Diunduh',
    message: `Laporan ${reportType} telah selesai dibuat dan siap diunduh.`,
    priority: 'medium'
  }),

  MAINTENANCE_MODE: (enabled) => ({
    type: enabled ? 'warning' : 'success',
    title: enabled ? 'Mode Maintenance Aktif' : 'Mode Maintenance Nonaktif',
    message: enabled 
      ? 'Sistem sedang dalam mode maintenance. Akses dibatasi untuk admin saja.'
      : 'Mode maintenance telah dinonaktifkan. Sistem kembali normal.',
    priority: 'high'
  }),

  BACKUP_SUCCESS: () => ({
    type: 'success',
    title: 'Backup Berhasil',
    message: 'Database telah berhasil di-backup.',
    priority: 'low'
  }),

  BACKUP_FAILED: () => ({
    type: 'error',
    title: 'Backup Gagal',
    message: 'Terjadi kesalahan saat melakukan backup database.',
    priority: 'high'
  }),

  AP_DATA_UPDATED: (namaAP, count) => ({
    type: 'info',
    title: 'Data AP Diperbarui',
    message: `${count} data untuk ${namaAP} telah diperbarui.`,
    priority: 'low'
  }),

  BULK_IMPORT_SUCCESS: (count) => ({
    type: 'success',
    title: 'Import Data Berhasil',
    message: `${count} data berhasil diimport ke sistem.`,
    priority: 'medium'
  }),

  BULK_IMPORT_FAILED: (error) => ({
    type: 'error',
    title: 'Import Data Gagal',
    message: `Terjadi kesalahan saat import data: ${error}`,
    priority: 'high'
  })
};