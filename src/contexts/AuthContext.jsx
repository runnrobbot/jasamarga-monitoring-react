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
    const validRoles = ['admin', 'pic', 'gm'];
    return validRoles.includes(role);
  };

  const isValidPIC = (userData) => {
    if (userData.role === 'pic' || userData.role === 'gm') {
      return userData.namaAP && userData.singkatanAP;
    }
    return true;
  };

  useEffect(() => {
    
    let isMounted = true; 
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) {
        return;
      }
            
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (!isMounted) return; 
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            

            if (!isValidRole(userData.role)) {
              await signOut(auth);
              if (isMounted) setUser(null);
              return;
            }

            if (!isValidPIC(userData)) {
              await signOut(auth);
              if (isMounted) setUser(null);
              return;
            }

            if (userData.status !== 'active') {
              await signOut(auth);
              if (isMounted) setUser(null);
              return;
            }

            if (isMounted) setUser(userData);
            
          } else {
            await signOut(auth);
            if (isMounted) setUser(null);
          }
        } catch (error) {
          if (isMounted) setUser(null);
        }
      } else {
        if (isMounted) setUser(null);
      }
      
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false; 
      unsubscribe();
    };
  }, []); 

  const login = async (username, password) => {
    try {
      setLoading(true);


      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('Username tidak ditemukan');
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      if (!isValidRole(userData.role)) {
        throw new Error(
          `Role '${userData.role}' tidak didukung. Sistem hanya menerima role 'admin', 'pic', atau 'gm'.`
        );
      }

      if (!isValidPIC(userData)) {
        throw new Error(
          'Akun PIC/GM Anda belum memiliki Nama AP atau Singkatan AP.'
        );
      }

      if (userData.status !== 'active') {
        throw new Error('Akun Anda tidak aktif. Hubungi administrator.');
      }

      if (!userData.email) {
        throw new Error('Akun Anda belum memiliki email. Hubungi administrator.');
      }

      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, userData.email, password);


      return { success: true, user: userData };

    } catch (error) {
      
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
      await signOut(auth);
      setUser(null);
    } catch (error) {
    }
  };

  const updateUser = (updatedData) => {
    
    if (updatedData.role && !isValidRole(updatedData.role)) {
      return;
    }

    const newUserData = { ...user, ...updatedData };
    if (!isValidPIC(newUserData)) {
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