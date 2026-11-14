'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCurrentUser,
  isCurrentUserAdmin,
  getPendingKyc,
  getKycSignedUrl,
  decideKyc,
  getBrokerWaitlist,
  signOut,
  PendingKycRow,
  BrokerWaitlistRow,
} from '@/lib/supabase';

type AuthState = 'checking' | 'signed-out' | 'not-admin' | 'admin';
type AdminTab = 'kyc' | 'waitlist';

/** One CSV-safe field: quoted, with embedded quotes doubled, whenever the
 * value itself contains a comma, quote, or newline — the three characters
 * that would otherwise break column alignment on import. */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function downloadBrokerWaitlistCsv(rows: BrokerWaitlistRow[]) {
  const header = ['email', 'source', 'created_at'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [csvField(row.email), csvField(row.source || ''), csvField(row.created_at)].join(',')
    );
  }
  // Leading BOM so Excel (which otherwise guesses the file's encoding)
  // reliably opens this as UTF-8 instead of mangling non-ASCII characters.
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `broker-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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

  const [activeTab, setActiveTab] = useState<AdminTab>('kyc');
  const [waitlistRows, setWaitlistRows] = useState<BrokerWaitlistRow[]>([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistLoaded, setWaitlistLoaded] = useState(false);

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

  useEffect(() => {
    if (authState !== 'admin' || activeTab !== 'waitlist' || waitlistLoaded) return;
    loadWaitlist();
  }, [authState, activeTab, waitlistLoaded]);

  const loadWaitlist = async () => {
    setLoadingWaitlist(true);
    setWaitlistError('');
    const result = await getBrokerWaitlist();
    if (result.success) {
      setWaitlistRows(result.rows || []);
      setWaitlistLoaded(true);
    } else {
      setWaitlistError(result.error || 'Failed to load the broker waitlist');
    }
    setLoadingWaitlist(false);
  };

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
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

        <div className="flex gap-2 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('kyc')}
            className={`px-4 py-2 font-semibold text-sm border-b-2 -mb-px transition ${
              activeTab === 'kyc'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Broker Verification
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`px-4 py-2 font-semibold text-sm border-b-2 -mb-px transition ${
              activeTab === 'waitlist'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Waitlist
          </button>
        </div>

        {activeTab === 'kyc' && (
        <>
        <p className="text-gray-600 -mt-4 mb-6">
          {rows.length} pending submission{rows.length === 1 ? '' : 's'}
        </p>

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
        </>
        )}

        {activeTab === 'waitlist' && (
          <>
            <div className="flex items-center justify-between mb-6 -mt-4">
              <p className="text-gray-600">
                {waitlistRows.length} signup{waitlistRows.length === 1 ? '' : 's'}
              </p>
              <button
                onClick={() => downloadBrokerWaitlistCsv(waitlistRows)}
                disabled={loadingWaitlist || waitlistRows.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>

            {waitlistError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{waitlistError}</div>
            )}

            {loadingWaitlist ? (
              <div className="text-gray-500">Loading…</div>
            ) : waitlistRows.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
                No waitlist signups yet.
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                      <th className="px-5 py-3">Email</th>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {waitlistRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-5 py-3 text-gray-900">{row.email}</td>
                        <td className="px-5 py-3 text-gray-500">{row.source || '—'}</td>
                        <td className="px-5 py-3 text-gray-500">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
