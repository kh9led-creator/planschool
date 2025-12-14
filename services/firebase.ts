import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDoc, setDoc } from 'firebase/firestore';

// Type for the configuration object
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

export const initFirebase = (config: FirebaseConfig) => {
  try {
    // Validate config presence to avoid crashing on empty env vars
    if (!config.apiKey || !config.projectId) {
        console.warn("Firebase Config missing. Running in local/offline mode.");
        return false;
    }

    if (!app) {
        app = initializeApp(config);
        db = getFirestore(app);
        console.log("Firebase initialized successfully");
    }
    return true;
  } catch (error) {
    console.error("Firebase Init Error:", error);
    return false;
  }
};

export const getDB = () => db;

// Helper to save entire school data object (simulating a document based structure)
export const saveSchoolData = async (schoolId: string, collectionName: string, data: any) => {
  if (!db) return;
  try {
    // Structure: schools/{schoolId}/data/{collectionName}
    const docRef = doc(db, 'schools', schoolId, 'data', collectionName);
    await setDoc(docRef, { items: data }, { merge: true });
  } catch (e) {
    console.error(`Error saving ${collectionName}:`, e);
  }
};

export const loadSchoolData = async (schoolId: string, collectionName: string) => {
  if (!db) return null;
  try {
    const docRef = doc(db, 'schools', schoolId, 'data', collectionName);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().items;
    }
    return null;
  } catch (e) {
    console.error(`Error loading ${collectionName}:`, e);
    return null;
  }
};

// --- System Level Sync (For Global School Registry) ---

export const saveSystemData = async (key: string, data: any) => {
  if (!db) return;
  try {
    // Structure: system/registry/settings/{key}
    const docRef = doc(db, 'system', 'registry', 'settings', key); 
    await setDoc(docRef, { value: data }, { merge: true });
  } catch (e) {
    console.error(`Error saving system data ${key}:`, e);
  }
};

export const loadSystemData = async (key: string) => {
  if (!db) return null;
  try {
    const docRef = doc(db, 'system', 'registry', 'settings', key);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().value;
    }
    return null;
  } catch (e) {
    console.error(`Error loading system data ${key}:`, e);
    return null;
  }
};