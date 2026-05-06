/**
 * Utility functions untuk formatting data
 */

/**
 * Format date ke format Indonesia
 * @param {Date|Timestamp} date - Date object atau Firebase Timestamp
 * @param {string} format - Format yang diinginkan ('short', 'long', 'time', 'datetime')
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
