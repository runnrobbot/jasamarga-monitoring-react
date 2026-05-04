import { useState } from 'react';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';

/**
 * Hook untuk fetching dan filtering data Komitmen dari Firestore.
 * Mendukung filter userAP (untuk PIC).
 * @param {Object} options
 * @param {string} [options.userAP=''] - Filter by AP name (PIC mode)
 */
const useKomitmenData = ({ userAP = '' } = {}) => {
  const [komitmenList, setKomitmenList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [masterAPList, setMasterAPList] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMasterAP = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'masterAP'));
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ap => ap.isActive);
      setMasterAPList(data);
    } catch (error) {
      console.error('Error fetching Master AP:', error);
      toast.error('Gagal memuat Master AP');
    }
  };

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = {};
      usersSnapshot.docs.forEach(doc => {
        usersData[doc.id] = doc.data();
      });
      return usersData;
    } catch (error) {
      console.error('Error fetching users:', error);
      return {};
    }
  };

  const fetchKomitmen = () => {
    setLoading(true);
    const q = query(collection(db, 'komitmen'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setKomitmenList(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening komitmen:', error);
        toast.error('Gagal memuat data komitmen');
        setLoading(false);
      }
    );

    return unsubscribe;
  };

  /**
   * Filter the komitmen list based on search and filter params.
   * @param {Object} params
   * @param {string} params.searchTerm
   * @param {string} params.filterStatus
   * @param {string} params.filterApprovalStatus
   */
  const filterData = ({ searchTerm = '', filterStatus = 'all', filterApprovalStatus = 'all' } = {}) => {
    let filtered = [...komitmenList];

    // PIC mode: filter by user's AP
    if (userAP) {
      filtered = filtered.filter(item => item.namaAP === userAP);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.namaPaket?.toLowerCase().includes(lower) ||
        item.namaAP?.toLowerCase().includes(lower) ||
        item.idPaketMonitoring?.toLowerCase().includes(lower)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    if (filterApprovalStatus !== 'all') {
      if (filterApprovalStatus === 'selesai') {
        filtered = filtered.filter(item => item.status === 'selesai');
      } else {
        filtered = filtered.filter(item => item.approvalStatus === filterApprovalStatus);
      }
    }

    setFilteredList(filtered);
  };

  return {
    komitmenList,
    setKomitmenList,
    filteredList,
    setFilteredList,
    masterAPList,
    loading,
    setLoading,
    fetchMasterAP,
    fetchUsers,
    fetchKomitmen,
    filterData,
  };
};

export default useKomitmenData;
