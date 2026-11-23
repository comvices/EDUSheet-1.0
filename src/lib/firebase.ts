import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with IndexedDB persistent local cache to dramatically cut daily read units
function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();

// Initialize Auth
export const auth = getAuth(app);

export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
export const FIRESTORE_PRICING_URL = 'https://firebase.google.com/pricing#cloud-firestore';

export interface FirestoreQuotaState {
  exceeded: boolean;
  path?: string | null;
  message?: string;
}

let currentQuotaState: FirestoreQuotaState = { exceeded: false };
const quotaListeners = new Set<(state: FirestoreQuotaState) => void>();

export function isQuotaExceededError(error: unknown): boolean {
  const errObj = error as { code?: string; message?: string } | null;
  const code = (errObj?.code || '').toLowerCase();
  const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('quota exceeded') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('resource-exhausted')
  );
}

export function getQuotaStatus(): FirestoreQuotaState {
  return currentQuotaState;
}

export function clearQuotaStatus(): void {
  if (!currentQuotaState.exceeded) return;
  currentQuotaState = { exceeded: false };
  quotaListeners.forEach((listener) => listener(currentQuotaState));
}

export function subscribeQuotaStatus(
  listener: (state: FirestoreQuotaState) => void
): () => void {
  quotaListeners.add(listener);
  listener(currentQuotaState);
  return () => {
    quotaListeners.delete(listener);
  };
}

function notifyQuotaExceeded(path: string | null, rawMessage: string): void {
  if (currentQuotaState.exceeded) return;
  currentQuotaState = {
    exceeded: true,
    path,
    message: rawMessage,
  };
  quotaListeners.forEach((listener) => listener(currentQuotaState));
}

const SESSION_PING_KEY = 'edusheet_fb_ping_v1';

// Validate Connection to Firestore on startup as mandated by Skill
export async function testConnection(force = false): Promise<boolean> {
  try {
    if (
      !force &&
      typeof window !== 'undefined' &&
      window.sessionStorage?.getItem(SESSION_PING_KEY) === '1'
    ) {
      return true;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
    try {
      window.sessionStorage?.setItem(SESSION_PING_KEY, '1');
    } catch {
      // Ignore sessionStorage restrictions
    }
    console.log('✅ Firebase Firestore connected successfully to', firebaseConfig.projectId);
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn('⚠️ Firestore daily quota reached during startup check:', msg);
      notifyQuotaExceeded('test/connection', msg);
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('⚠️ Firebase Firestore: client is offline or establishing connection.');
    } else {
      console.log('ℹ️ Firestore ping response:', error);
    }
    return false;
  }
}

testConnection();

// Standard Error Handler conforming to Skill requirements
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
    },
    operationType,
    path,
  };

  if (isQuotaExceededError(error)) {
    console.warn(`⚠️ Firestore quota exceeded on ${operationType} (${path || 'unknown'}):`, message);
    notifyQuotaExceeded(path, message);
    return errInfo;
  }

  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}
