/**
 * JWT Utilities for Browser-based JWT Management
 * Using 'jose' library (browser-compatible)
 */

import * as jose from 'jose';

// Get secrets from environment variables
const ACCESS_TOKEN_SECRET = import.meta.env.VITE_ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = import.meta.env.VITE_REFRESH_TOKEN_SECRET;

// Token expiration times
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d';  // 7 days

/**
 * Validate environment variables
 */
const validateSecrets = () => {
  if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    console.error('JWT secrets not configured! Check your .env file.');
    console.error('Required variables:');
    console.error('- VITE_ACCESS_TOKEN_SECRET');
    console.error('- VITE_REFRESH_TOKEN_SECRET');
    throw new Error('JWT secrets missing. Please configure .env file.');
  }

  if (ACCESS_TOKEN_SECRET.length < 32 || REFRESH_TOKEN_SECRET.length < 32) {
    console.warn('WARNING: JWT secrets should be at least 32 characters long for security!');
  }
};

// Validate on module load
validateSecrets();

/**
 * Generate Access and Refresh Tokens
 * @param {Object} payload - User data to encode in token { uid, username, role }
 * @returns {Object} { accessToken, refreshToken }
 */
export const generateToken = (payload) => {
  try {
    // Convert secret strings to Uint8Array for jose
    const accessSecret = new TextEncoder().encode(ACCESS_TOKEN_SECRET);
    const refreshSecret = new TextEncoder().encode(REFRESH_TOKEN_SECRET);

    // Generate Access Token (short-lived)
    const accessTokenPromise = new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(accessSecret);

    // Generate Refresh Token (long-lived)
    const refreshTokenPromise = new jose.SignJWT({ uid: payload.uid })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .sign(refreshSecret);

    // Return promises (will be awaited by caller)
    return Promise.all([accessTokenPromise, refreshTokenPromise])
      .then(([accessToken, refreshToken]) => ({
        accessToken,
        refreshToken
      }));
  } catch (error) {
    console.error('Token generation error:', error);
    throw new Error('Failed to generate authentication tokens');
  }
};

/**
 * Verify JWT Token
 * @param {string} token - JWT token to verify
 * @param {string} type - 'access' or 'refresh'
 * @returns {Object|null} Decoded payload or null if invalid
 */
export const verifyToken = async (token, type = 'access') => {
  try {
    // Check if token is valid string
    if (!token || typeof token !== 'string' || token.trim() === '') {
      console.error('Invalid token format: token must be a non-empty string');
      return null;
    }

    const secret = type === 'access' 
      ? new TextEncoder().encode(ACCESS_TOKEN_SECRET)
      : new TextEncoder().encode(REFRESH_TOKEN_SECRET);

    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch (error) {
    // Silently return null for invalid tokens (common during logout/refresh)
    if (error.code === 'ERR_JWT_EXPIRED') {
      console.log('Token expired (will attempt refresh)');
    } else if (error.code !== 'ERR_JWS_INVALID') {
      console.error('Token verification error:', error.message);
    }
    return null;
  }
};

/**
 * Refresh Access Token using Refresh Token
 * @param {string} refreshToken - Valid refresh token
 * @returns {Object|null} New tokens { accessToken, refreshToken } or null
 */
export const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = await verifyToken(refreshToken, 'refresh');
    
    if (!decoded || !decoded.uid) {
      console.error('Invalid refresh token payload');
      return null;
    }

    // Generate new tokens
    const newTokens = await generateToken({
      uid: decoded.uid,
      // Note: username and role will be re-fetched from database by caller
    });

    return newTokens;
  } catch (error) {
    console.error('Token refresh error:', error.message);
    return null;
  }
};

/**
 * Decode JWT without verification (for debugging/inspection)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
export const decodeToken = (token) => {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }
    return jose.decodeJwt(token);
  } catch (error) {
    console.error('Token decode error:', error);
    return null;
  }
};

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} True if expired
 */
export const isTokenExpired = (token) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    return Date.now() >= decoded.exp * 1000;
  } catch (error) {
    return true;
  }
};

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null
 */
export const getTokenExpiration = (token) => {
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return null;
    
    return new Date(decoded.exp * 1000);
  } catch (error) {
    return null;
  }
};

// Export for debugging purposes (remove in production)
export const debugTokens = () => {
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');

  console.group('🔐 JWT Debug Info');
  console.log('Access Token:', accessToken ? decodeToken(accessToken) : 'None');
  console.log('Refresh Token:', refreshToken ? decodeToken(refreshToken) : 'None');
  console.log('Access Token Expired:', accessToken ? isTokenExpired(accessToken) : 'N/A');
  console.log('Refresh Token Expired:', refreshToken ? isTokenExpired(refreshToken) : 'N/A');
  console.groupEnd();
};