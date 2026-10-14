'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCurrentUser,
  isCurrentUserAdmin,
  getPendingKyc,
  getKycSignedUrl,
  decideKyc,
  signOut,
  PendingKycRow,
} from '@/lib/supabase';

type AuthState = 'checking' | 'signed-out' | 'not-admin' | 'admin';

interface ExpandedPhotos {
  idUrl: string | null;
  selfieUrl: string | null;
  loading: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [rows, setRows] = useState<PendingKycRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [listError, setListError] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, ExpandedPhotos>>({});
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [decisionLoading, setDecisionLoading] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const user = await getCurrentUser();
      if (!user) {
        setAuthState('signed-out');
        return;
      }
      const admin = await isCurrentUserAdmin();
      setAuthState(admin ? 'admin' : 'not-admin');
    };
    check();
  }, []);

  useEffect(() => {
    if (authState !== 'admin') return;
    loadPending();
  }, [authState]);

  const loadPending = async () => {
    setLoadingRows(true);
    setListError('');
    const result = await getPendingKyc();
    if (result.success) {
      setRows(result.rows || []);
    } else {
      setListError(result.error || 'Failed to load pending submissions');
    }
    setLoadingRows(false);
  };

  const toggleExpand = async (row: PendingKycRow) => {
    if (expandedUserId === row.user_id) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(row.user_id);
    setRejectingUserId(null);

    if (photos[row.user_id]) return;

    setPhotos((prev) => ({ ...prev, [row.user_id]: { idUrl: null, selfieUrl: null, loading: true } }));
    const [idUrl, selfieUrl] = await Promise.all([
      row.kyc_id_url ? getKycSignedUrl(row.kyc_id_url) : Promise.resolve(null),
      row.kyc_selfie_url ? getKycSignedUrl(row.kyc_selfie_url) : Promise.resolve(null),
    ]);
    setPhotos((prev) => ({ ...prev, [row.user_id]: { idUrl, selfieUrl, loading: false } }));
  };

  const handleApprove = async (userId: string) => {
    setDecisionLoading(userId);
    const result = await decideKyc(userId, 'approved');
    setDecisionLoading(null);
    if (result.success) {
      setRows((prev) => prev.filter((r) => r.user_id !== userId));
    } else {
      setListError(result.error || 'Failed to approve');
    }
  };

  const handleReject = async (userId: string) => {
    setDecisionLoading(userId);
    const result = await decideKyc(userId, 'rejected', rejectReason.trim() || undefined);
    setDecisionLoading(null);
    if (result.success) {
      setRows((prev) => prev.filter((r) => r.user_id !== userId));
      setRejectingUserId(null);
      setRejectReason('');
    } else {
      setListError(result.error || 'Failed to reject');
    }
  };

  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Checking access…
      </div>
    );
  }

  if (authState === 'signed-out') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Sign In Required</h1>
          <p className="text-gray-600 mb-6">Sign in with an admin account to review broker verifications.</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (authState === 'not-admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Not Authorized</h1>
          <p className="text-gray-600">This account doesn&apos;t have admin access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Broker Verification</h1>
            <p className="text-gray-600 mt-1">
              {rows.length} pending submission{rows.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              router.push('/auth/login');
            }}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>

        {listError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{listError}</div>
        )}

        {loadingRows ? (
          <div className="text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
            No pending submissions. Nothing to review right now.
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const name = [row.users?.first_name, row.users?.last_name, row.users?.suffix]
                .filter(Boolean)
                .join(' ');
              const isExpanded = expandedUserId === row.user_id;
              const photo = photos[row.user_id];
              const isRejecting = rejectingUserId === row.user_id;
              const isDeciding = decisionLoading === row.user_id;

              return (
                <div key={row.user_id} className="bg-white rounded-xl shadow overflow-hidden">
                  <button
                    onClick={() => toggleExpand(row)}
                    className="w-full text-left p-5 flex items-center justify-between hover:bg-gray-50 transition"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{name || '(no name on file)'}</p>
                      <p className="text-sm text-gray-500">
                        {row.users?.email} · {row.company_name} · {row.role}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Submitted {new Date(row.kyc_submitted_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-5">
                      {row.license_number && (
                        <p className="text-sm text-gray-600 mb-4">License #: {row.license_number}</p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">ID Photo</p>
                          {photo?.loading ? (
                            <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center text-gray-400">
                              Loading…
                            </div>
                          ) : photo?.idUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo.idUrl}
                              alt="Uploaded ID"
                              className="rounded-lg w-full h-48 object-contain bg-gray-50 border border-gray-200"
                            />
                          ) : (
                            <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center text-gray-400 text-sm">
                              No ID photo
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Selfie</p>
                          {photo?.loading ? (
                            <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center text-gray-400">
                              Loading…
                            </div>
                          ) : photo?.selfieUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo.selfieUrl}
                              alt="Verification selfie"
                              className="rounded-lg w-full h-48 object-contain bg-gray-50 border border-gray-200"
                            />
                          ) : (
                            <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center text-gray-400 text-sm">
                              No selfie
                            </div>
                          )}
                        </div>
                      </div>

                      {isRejecting ? (
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Reason (optional — kept on file, not currently shown to the broker)
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 outline-none focus:ring-2 focus:ring-red-400"
                            placeholder="e.g. ID photo is blurry, can't verify the name"
                          />
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleReject(row.user_id)}
                              disabled={isDeciding}
                              className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
                            >
                              {isDeciding ? 'Rejecting…' : 'Confirm Reject'}
                            </button>
                            <button
                              onClick={() => {
                                setRejectingUserId(null);
                                setRejectReason('');
                              }}
                              disabled={isDeciding}
                              className="px-4 py-2 rounded-lg font-semibold text-gray-600 hover:bg-gray-100 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleApprove(row.user_id)}
                            disabled={isDeciding}
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {isDeciding ? 'Approving…' : '✓ Approve'}
                          </button>
                          <button
                            onClick={() => setRejectingUserId(row.user_id)}
                            disabled={isDeciding}
                            className="flex-1 bg-white border border-red-300 text-red-600 py-2 rounded-lg font-semibold hover:bg-red-50 transition disabled:opacity-50"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
