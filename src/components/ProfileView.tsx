import React, { useEffect, useState } from 'react';
import { Edit3, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatDate } from '../lib/format';
import { UserProfile } from '../types';

interface ProfileViewProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onRefreshNotifications: () => void;
}

export function ProfileView({
  user,
  onUserUpdated,
  onRefreshNotifications,
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [designation, setDesignation] = useState(user.designation);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone);
    setDesignation(user.designation);
  }, [user]);

  const handleOpenEdit = () => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone);
    setDesignation(user.designation);
    setProfileMsg(null);
    setError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone);
    setDesignation(user.designation);
    setError(null);
    setIsEditing(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    setError(null);
    try {
      const res = await apiFetch<{ user: UserProfile; updatedFieldsCount: number }>(
        '/api/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({ name, email, phone, designation }),
        }
      );
      onUserUpdated(res.user);
      setIsEditing(false);
      if (res.updatedFieldsCount > 0) {
        setProfileMsg('Profile updated and HR has been notified.');
        onRefreshNotifications();
      } else {
        setProfileMsg('No profile changes detected.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPass(true);
    setPassMsg(null);
    setError(null);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setPassMsg('Password updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My Profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            Your work record, department assignment, and account security settings.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={handleOpenEdit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors self-start whitespace-nowrap"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Edit profile</span>
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
        >
          {error}
        </div>
      )}

      {profileMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {profileMsg}
        </div>
      )}

      {/* Work Record Details / Edit Form */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {isEditing ? 'Edit Profile Details' : 'Work Information'}
            </h3>
            {isEditing && (
              <p className="mt-0.5 text-xs text-slate-500">
                Saving changes automatically sends a notification to HR.
              </p>
            )}
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={handleCancelEdit}
              aria-label="Cancel profile edit"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-profile-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="edit-profile-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-profile-email"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Work Email
                </label>
                <input
                  id="edit-profile-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-profile-phone"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Phone Number
                </label>
                <input
                  id="edit-profile-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (415) 555-0100"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-profile-designation"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Designation
                </label>
                <input
                  id="edit-profile-designation"
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-500">
              <div>
                <div>Employee ID</div>
                <div className="mt-1 font-mono text-slate-800">{user.employeeCode}</div>
              </div>
              <div>
                <div>Department</div>
                <div className="mt-1 font-medium text-slate-800">
                  {user.departmentName || 'Unassigned'}
                </div>
              </div>
              <div>
                <div>Role</div>
                <div className="mt-1 font-medium text-slate-800">{user.role}</div>
              </div>
              <div>
                <div>Joining Date</div>
                <div className="mt-1 font-mono text-slate-800 tabular-nums">
                  {formatDate(user.joiningDate)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {savingProfile ? 'Saving...' : 'Save profile changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Full Name</dt>
              <dd className="mt-1 font-medium text-slate-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Employee ID</dt>
              <dd className="mt-1 font-mono text-slate-900">{user.employeeCode}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Role</dt>
              <dd className="mt-1 font-medium text-slate-900">{user.role}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Department</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {user.departmentName || 'Unassigned'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Designation</dt>
              <dd className="mt-1 font-medium text-slate-900">{user.designation}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Work Email</dt>
              <dd className="mt-1 text-slate-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Phone Number</dt>
              <dd className="mt-1 font-mono text-slate-900">{user.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Joining Date</dt>
              <dd className="mt-1 font-mono text-slate-900 tabular-nums">
                {formatDate(user.joiningDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Employment Status</dt>
              <dd className="mt-1 font-medium text-slate-900">{user.status}</dd>
            </div>
          </dl>
        )}
      </section>

      {/* Password Update */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 max-w-md">
        <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>
        <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
          <div>
            <label htmlFor="cur-pass" className="block text-xs font-medium text-slate-700 mb-1">
              Current password
            </label>
            <input
              id="cur-pass"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-pass" className="block text-xs font-medium text-slate-700 mb-1">
              New password (min 6 characters)
            </label>
            <input
              id="new-pass"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          {passMsg && <div className="text-xs text-emerald-700">{passMsg}</div>}
          <button
            type="submit"
            disabled={savingPass}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            {savingPass ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}
