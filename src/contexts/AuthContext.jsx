import { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc,
  doc 
} from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isValidRole = (role) => {
    const validRoles = ['admin', 'pic'];
    return validRoles.includes(role);
  };

  const isValidPIC = (userData) => {
    if (userData.role === 'pic') {
      return userData.namaAP && userData.singkatanAP;
    }
    return true;
  };

  // ✅ Auth state listener with proper cleanup
  useEffect(() => {
    console.log('🔄 Setting up auth state listener...');
    
    let isMounted = true; // ✅ Track component mount state
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // ✅ Don't update state if component unmounted
      if (!isMounted) {
        console.log('⚠️ Component unmounted, skipping state update');
        return;
      }
      
      console.log('🔔 Auth state changed:', firebaseUser ? firebaseUser.uid : 'null');
      
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (!isMounted) return; // ✅ Check again after async operation
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            console.log('📋 Fetched user data:', {
              uid: userData.uid,
              username: userData.username,
              role: userData.role,
              status: userData.status
            });

            if (!isValidRole(userData.role)) {
              console.warn('⚠️ Invalid role:', userData.role);
              await signOut(auth);
              if (isMounted) setUser(null);
              return;
            }

            if (!isValidPIC(userData)) {
              console.warn('⚠️ PIC missing required fields');
              await signOut(auth);
              if (isMounted) setUser(null);
              return;
            }

            if (userData.status !== 'active') {
              console.warn('⚠️ User is not active');
              await signOut(auth);
              if (isMounted) setUser(null);
              return;
            }

            console.log('✅ Setting user state:', userData.username);
            if (isMounted) setUser(userData);
            
          } else {
            console.warn('⚠️ User document not found for UID:', firebaseUser.uid);
            await signOut(auth);
            if (isMounted) setUser(null);
          }
        } catch (error) {
          console.error('❌ Error fetching user data:', error);
          if (isMounted) setUser(null);
        }
      } else {
        console.log('🚪 User signed out, clearing state');
        if (isMounted) setUser(null);
      }
      
      if (isMounted) setLoading(false);
    });

    return () => {
      console.log('🔌 Cleaning up auth state listener');
      isMounted = false; // ✅ Mark as unmounted
      unsubscribe();
    };
  }, []); // ✅ Empty deps array - only run once

  const login = async (username, password) => {
    try {
      setLoading(true);

      console.log('🔐 Starting login for:', username);

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Username tidak ditemukan');
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      console.log('📋 Found user:', {
        uid: userData.uid,
        username: userData.username,
        email: userData.email,
        role: userData.role
      });

      if (!isValidRole(userData.role)) {
        throw new Error(
          `Role '${userData.role}' tidak didukung. Sistem hanya menerima role 'admin' atau 'pic'.`
        );
      }

      if (!isValidPIC(userData)) {
        throw new Error(
          'Akun PIC Anda belum memiliki Nama AP atau Singkatan AP.'
        );
      }

      if (userData.status !== 'active') {
        throw new Error('Akun Anda tidak aktif. Hubungi administrator.');
      }

      if (!userData.email) {
        throw new Error('Akun Anda belum memiliki email. Hubungi administrator.');
      }

      console.log('🔑 Signing in with Firebase Auth...');
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, userData.email, password);

      console.log('✅ Firebase Auth successful');

      return { success: true, user: userData };

    } catch (error) {
      console.error('❌ Login error:', error);
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error('Password salah');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('User tidak ditemukan di Firebase Authentication');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Terlalu banyak percobaan login. Coba lagi nanti.');
      } else if (error.code === 'permission-denied') {
        throw new Error('Akses ditolak. Periksa pengaturan Firestore rules.');
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out user:', user?.username);
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const updateUser = (updatedData) => {
    console.log('🔄 Updating user data:', updatedData);
    
    if (updatedData.role && !isValidRole(updatedData.role)) {
      console.error('❌ Cannot update to invalid role:', updatedData.role);
      return;
    }

    const newUserData = { ...user, ...updatedData };
    if (!isValidPIC(newUserData)) {
      console.error('❌ PIC update missing required fields');
      return;
    }

    setUser(newUserData);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;