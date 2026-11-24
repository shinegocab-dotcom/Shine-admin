import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleAuthProvider } from '../lib/firebase';
import { AdminRoleId, AdminUser } from '../types/domain';
import { ensureBootstrappedAdminDoc } from '../services/firestoreService';
import { hasPermission, PermissionAction, PermissionModule } from '../lib/rbac';

interface AuthContextValue {
  user: User | null;
  adminProfile: AdminUser | null;
  roleId: AdminRoleId;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  can: (module: PermissionModule, action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [roleId, setRoleId] = useState<AdminRoleId>('read_only_admin');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthError(null);

      if (!firebaseUser) {
        setAdminProfile(null);
        setRoleId('read_only_admin');
        setLoading(false);
        return;
      }

      try {
        if (firebaseUser.email === 'ma94646445@gmail.com') {
          await ensureBootstrappedAdminDoc();
        }
        const adminSnap = await getDoc(doc(db, 'admin_users', firebaseUser.uid));
        if (adminSnap.exists()) {
          const data = { id: adminSnap.id, ...adminSnap.data() } as AdminUser;
          setAdminProfile(data);
          setRoleId(data.isActive ? data.roleId : 'read_only_admin');
        } else if (firebaseUser.email === 'ma94646445@gmail.com') {
          setRoleId('super_admin');
        } else {
          setAdminProfile(null);
          setRoleId('read_only_admin');
        }
      } catch (err) {
        console.error('Admin profile lookup failed:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed');
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const getToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction) => {
      if (!user) return false;
      return hasPermission(roleId, module, action);
    },
    [user, roleId]
  );

  return (
    <AuthContext.Provider
      value={{ user, adminProfile, roleId, loading, authError, signInWithGoogle, logout, getToken, can }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
