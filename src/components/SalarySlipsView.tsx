import { FileText } from 'lucide-react';
import { UserProfile } from '../types';

export function SalarySlipsView({ user }: { user: UserProfile }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Salary Slips</h2>
        <p className="mt-1 text-sm text-slate-600">
          Published monthly payslips for {user.name} ({user.employeeCode}).
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <div className="mx-auto w-11 h-11 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
          <FileText className="w-5 h-5" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Payroll is not currently configured
        </h3>
        <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          This page is reserved for published salary slips. Once HR enables payroll runs for your
          organization, monthly payslips will appear here automatically.
        </p>
      </section>
    </div>
  );
}
