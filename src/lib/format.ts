export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(isoOrTime: string | null): string {
  if (!isoOrTime) return '—';
  if (/^\d{2}:\d{2}$/.test(isoOrTime)) {
    const [hStr, mStr] = isoOrTime.split(':');
    const h = Number(hStr);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${mStr} ${suffix}`;
  }
  const d = new Date(isoOrTime);
  if (Number.isNaN(d.getTime())) return isoOrTime;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatWorkedHours(
  clockInIso: string,
  clockOutIso: string | null,
  breakMinutes: number
): string {
  if (!clockOutIso) return 'Active';
  const start = new Date(clockInIso).getTime();
  const end = new Date(clockOutIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return '0h 00m';
  const netMinutes = Math.max(0, Math.round((end - start) / 60000) - breakMinutes);
  const hours = Math.floor(netMinutes / 60);
  const mins = netMinutes % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export function computeDaysInclusive(startDate: string, endDate: string): number {
  const s = new Date(`${startDate}T00:00:00`).getTime();
  const e = new Date(`${endDate}T00:00:00`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 1;
  return Math.round((e - s) / 86400000) + 1;
}
