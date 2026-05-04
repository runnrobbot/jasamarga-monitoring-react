/**
 * Format a numeric string into Indonesian Rupiah display format.
 * Example: "1500000" → "1.500.000"
 * @param {string|number} value
 * @returns {string}
 */
export const formatRupiahInput = (value) => {
  if (!value) return '';
  const numericValue = value.toString().replace(/[^\d,]/g, '');
  const parts = numericValue.split(',');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.length > 1 ? `${parts[0]},${parts[1].slice(0, 2)}` : parts[0];
};

/**
 * Parse a formatted Rupiah string back to a float number.
 * Example: "1.500.000" → 1500000
 * @param {string|number} value
 * @returns {number}
 */
export const parseRupiahInput = (value) => {
  if (!value) return 0;
  const cleanValue = value.toString().replace(/\./g, '').replace(/,/g, '.');
  return parseFloat(cleanValue) || 0;
};

/**
 * Format a number as Indonesian Rupiah currency string.
 * Example: 1500000 → "Rp 1.500.000"
 * @param {number} value
 * @returns {string}
 */
export const formatCurrency = (value) => {
  if (!value) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};
