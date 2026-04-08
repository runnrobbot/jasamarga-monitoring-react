/**
 * Utility functions untuk formatting data
 */

/**
 * Format number ke format currency Rupiah
 * @param {number} value - Nilai yang akan diformat
 * @param {boolean} showCurrency - Tampilkan simbol Rp atau tidak
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (value, showCurrency = true) => {
  if (value === null || value === undefined || isNaN(value)) {
    return showCurrency ? 'Rp 0' : '0';
  }

  const formatted = new Intl.NumberFormat('id-ID', {
    style: showCurrency ? 'currency' : 'decimal',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);

  return formatted;
};

/**
 * Format date ke format Indonesia
 * @param {Date|Timestamp} date - Date object atau Firebase Timestamp
 * @param {string} format - Format yang diinginkan ('short', 'long', 'time')
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, format = 'short') => {
  if (!date) return '-';

  // Convert Firebase Timestamp to Date
  const dateObj = date.toDate ? date.toDate() : new Date(date);

  const options = {
    short: {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    },
    long: {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    },
    time: {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    },
    datetime: {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  };

  return dateObj.toLocaleDateString('id-ID', options[format] || options.short);
};

/**
 * Format percentage
 * @param {number} value - Nilai yang akan diformat
 * @param {number} decimals - Jumlah desimal
 * @returns {string} - Formatted percentage string
 */
export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  return `${Number(value).toFixed(decimals)}%`;
};

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Truncate text dengan ellipsis
 * @param {string} text - Text to truncate
 * @param {number} length - Max length
 * @returns {string} - Truncated text
 */
export const truncateText = (text, length = 50) => {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
};

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} - Initials
 */
export const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

/**
 * Calculate progress percentage
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @returns {number} - Percentage (0-100)
 */
export const calculateProgress = (current, total) => {
  if (!total || total === 0) return 0;
  const progress = (current / total) * 100;
  return Math.min(Math.max(progress, 0), 100);
};

/**
 * Get status badge variant based on percentage
 * @param {number} percentage - Progress percentage
 * @returns {string} - Bootstrap variant (success, warning, danger)
 */
export const getStatusVariant = (percentage) => {
  if (percentage >= 100) return 'success';
  if (percentage >= 75) return 'info';
  if (percentage >= 50) return 'warning';
  return 'danger';
};

/**
 * Get month name in Indonesian
 * @param {number} month - Month number (1-12)
 * @returns {string} - Month name
 */
export const getMonthName = (month) => {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[month - 1] || '';
};

/**
 * Parse number dari string yang sudah diformat
 * @param {string} formattedNumber - Formatted number string
 * @returns {number} - Parsed number
 */
export const parseFormattedNumber = (formattedNumber) => {
  if (!formattedNumber) return 0;
  // Remove all non-digit characters except minus and decimal point
  const cleaned = formattedNumber.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
};

/**
 * Format phone number Indonesia
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  // Remove non-digits
  const cleaned = phone.replace(/\D/g, '');
  // Format as +62 xxx-xxxx-xxxx
  if (cleaned.startsWith('62')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
  }
  return phone;
};

/**
 * Get relative time (e.g., "2 jam yang lalu")
 * @param {Date|Timestamp} date - Date to compare
 * @returns {string} - Relative time string
 */
export const getRelativeTime = (date) => {
  if (!date) return '';
  
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  if (diffDays < 30) return `${diffDays} hari yang lalu`;
  
  return formatDate(dateObj, 'short');
};