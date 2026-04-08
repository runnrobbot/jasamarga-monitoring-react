import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Check if AP schedule allows data input
 * @param {string} apId - Master AP document ID
 * @param {string} namaAP - Nama AP (fallback if apId not available)
 * @returns {Promise<{allowed: boolean, message: string, schedule: object|null}>}
 */
export const checkAPSchedule = async (apId, namaAP) => {
  try {
    // Get all schedules
    const scheduleDoc = await getDoc(doc(db, 'settings', 'apSchedules'));
    
    if (!scheduleDoc.exists()) {
      // No schedules configured - allow all
      return { 
        allowed: true, 
        message: 'Schedule belum dikonfigurasi untuk AP ini', 
        schedule: null 
      };
    }

    const schedules = scheduleDoc.data();
    
    // Find schedule for this AP
    let schedule = null;
    
    // Try to find by apId first
    if (apId && schedules[apId]) {
      schedule = schedules[apId];
    } else if (namaAP) {
      // Fallback: find by namaAP
      const scheduleEntry = Object.values(schedules).find(s => s.namaAP === namaAP);
      if (scheduleEntry) {
        schedule = scheduleEntry;
      }
    }

    // No schedule found for this AP
    if (!schedule) {
      return { 
        allowed: false, 
        message: `Schedule belum dikonfigurasi untuk AP ${namaAP || apId}. Silakan hubungi administrator.`, 
        schedule: null 
      };
    }

    // Check if schedule is active
    if (!schedule.isActive) {
      return { 
        allowed: false, 
        message: 'Schedule untuk AP ini sedang dinonaktifkan. Silakan hubungi administrator.', 
        schedule 
      };
    }

    // Check date range
    const now = new Date();
    const tanggalBuka = new Date(schedule.tanggalBuka);
    const tanggalTutup = new Date(schedule.tanggalTutup);

    // Not open yet
    if (now < tanggalBuka) {
      return { 
        allowed: false, 
        message: `Periode input belum dibuka. Dimulai pada ${tanggalBuka.toLocaleDateString('id-ID', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}.`, 
        schedule 
      };
    }

    // Already closed
    if (now > tanggalTutup) {
      return { 
        allowed: false, 
        message: `Periode input sudah ditutup. Berakhir pada ${tanggalTutup.toLocaleDateString('id-ID', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}.`, 
        schedule 
      };
    }

    // Schedule is valid and currently open
    const remainingDays = Math.ceil((tanggalTutup - now) / (1000 * 60 * 60 * 24));
    
    return { 
      allowed: true, 
      message: `Periode input aktif. Berakhir pada ${tanggalTutup.toLocaleDateString('id-ID')} (${remainingDays} hari lagi).`, 
      schedule,
      remainingDays 
    };

  } catch (error) {
    console.error('Error checking AP schedule:', error);
    // In case of error, deny access for safety
    return { 
      allowed: false, 
      message: 'Gagal memeriksa schedule. Silakan coba lagi atau hubungi administrator.', 
      schedule: null 
    };
  }
};

/**
 * Get schedule info for display purposes
 * @param {string} apId - Master AP document ID
 * @returns {Promise<object|null>}
 */
export const getAPScheduleInfo = async (apId) => {
  try {
    const scheduleDoc = await getDoc(doc(db, 'settings', 'apSchedules'));
    
    if (!scheduleDoc.exists()) {
      return null;
    }

    const schedules = scheduleDoc.data();
    return schedules[apId] || null;
  } catch (error) {
    console.error('Error getting AP schedule info:', error);
    return null;
  }
};

/**
 * Format schedule status for display
 * @param {object} schedule - Schedule object
 * @returns {object} - {status, message, color, icon}
 */
export const formatScheduleStatus = (schedule) => {
  if (!schedule) {
    return {
      status: 'no-schedule',
      message: 'Belum dikonfigurasi',
      color: 'secondary',
      icon: '❓'
    };
  }

  if (!schedule.isActive) {
    return {
      status: 'disabled',
      message: 'Dinonaktifkan',
      color: 'danger',
      icon: '🚫'
    };
  }

  const now = new Date();
  const tanggalBuka = new Date(schedule.tanggalBuka);
  const tanggalTutup = new Date(schedule.tanggalTutup);

  if (now < tanggalBuka) {
    return {
      status: 'not-open',
      message: `Belum dibuka (${tanggalBuka.toLocaleDateString('id-ID')})`,
      color: 'warning',
      icon: '🔒'
    };
  } else if (now > tanggalTutup) {
    return {
      status: 'closed',
      message: `Sudah ditutup (${tanggalTutup.toLocaleDateString('id-ID')})`,
      color: 'danger'    
    };
  } else {
    const remainingDays = Math.ceil((tanggalTutup - now) / (1000 * 60 * 60 * 24));
    return {
      status: 'open',
      message: `Aktif (${remainingDays} hari lagi)`,
      color: 'success'
    };
  }
};