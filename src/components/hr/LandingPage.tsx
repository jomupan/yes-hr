import type { UseHrSession } from "@/hooks/use-hr-session";
import {
  ShieldCheck,
  Clock,
  Calendar,
  FileText,
  Award,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Lock,
} from "lucide-react";

interface Props {
  hr: UseHrSession;
}

const YES_EMPIRE_LOGO =
  "https://vibe.filesafe.space/1786075267723187770/attachments/4e504305-8d67-43cf-b05f-f75e9736b640.webp";

export function LandingPage({ hr }: Props) {
  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#e2e8f0] selection:bg-[#d97706]/30 selection:text-[#fef3c7] font-sans antialiased overflow-x-hidden">
      {/* Top Gold Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-[#d97706]/15 via-[#b45309]/5 to-transparent blur-3xl pointer-events-none" />

      {/* Navigation Bar */}
      <nav className="relative z-20 border-b border-white/10 bg-[#0b0f19]/80 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-4">
            <div className="h-10 sm:h-12 flex items-center p-1.5 rounded-lg bg-black/40 border border-amber-500/20 shadow-inner">
              <img
                src={YES_EMPIRE_LOGO}
                alt="YES EMPIRE Logo"
                className="h-full object-contain filter drop-shadow-[0_0_8px_rgba(217,119,6,0.3)]"
              />
            </div>
            <div className="hidden sm:flex flex-col border-l border-white/15 pl-4">
              <span className="font-mono-hr text-[10px] tracking-[0.2em] text-amber-400 font-semibold uppercase">
                HR Management System
              </span>
              <span className="text-xs text-white font-medium tracking-wide">
                YES EMPIRE HR Portal
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={hr.goToLogin}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white font-medium text-xs sm:text-sm transition-all duration-200 hover:border-amber-500/40"
            >
              Log In
            </button>
            <button
              onClick={hr.goToRegister}
              className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2"
            >
              <span>Register Staff</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-20 sm:pt-24 sm:pb-32 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold tracking-wide mb-8 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>EXCLUSIVE HUMAN RESOURCE MANAGEMENT PORTAL</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-amber-500 to-amber-600">
              YES Empire Group
            </span>{" "}
            Elevate System
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
            A comprehensive system for attendance management, leave
            applications, payslips, expense claims, and the Dope Personality
            Test integrity assessment — all in one premium platform.
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={hr.goToLogin}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 font-extrabold text-base shadow-xl shadow-amber-500/20 hover:shadow-amber-500/35 hover:scale-105 transition-all duration-200 flex items-center justify-center gap-3"
            >
              <span>Access Staff Portal</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={hr.goToRegister}
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>New Registration</span>
            </button>
          </div>

          {/* Trust Badges */}
          <div className="mt-14 pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-slate-400 text-xs sm:text-sm font-medium">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Dope Personality Test Integrity</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>GPS Attendance & Selfie</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Detailed Payslips</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Fast Claim Approvals</span>
            </div>
          </div>
        </div>

        {/* Hero Visual Showcase Preview */}
        <div className="mt-16 relative max-w-5xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 to-amber-700/30 rounded-3xl blur-2xl opacity-60" />
          <div className="relative rounded-2xl bg-[#111726] border border-amber-500/20 p-4 sm:p-6 shadow-2xl overflow-hidden">
            {/* Window Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono-hr text-xs text-slate-400">
                  YES EMPIRE HR System v2.4
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono-hr text-amber-400/90 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                <Lock className="w-3 h-3" />
                <span>SECURE PORTAL</span>
              </div>
            </div>

            {/* Simulated UI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#182133] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400 uppercase font-mono-hr">
                    Dope Personality Test
                  </span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-white mb-1">
                  VERIFIED PASSED
                </div>
                <div className="text-xs text-emerald-400 font-medium">
                  Valid for 182 days
                </div>
              </div>

              <div className="bg-[#182133] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400 uppercase font-mono-hr">
                    Attendance Module
                  </span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-white mb-1">
                  08:58 AM
                </div>
                <div className="text-xs text-slate-400">
                  Location & Selfie Verified
                </div>
              </div>

              <div className="bg-[#182133] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-400 uppercase font-mono-hr">
                    Annual Leave Balance
                  </span>
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-xl font-bold text-white mb-1">14 Days</div>
                <div className="text-xs text-slate-400">
                  0 Pending Applications
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section className="py-20 bg-[#080b12] border-t border-white/10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-mono-hr text-amber-400 uppercase tracking-[0.2em] mb-3">
              Core System Features
            </h2>
            <p className="text-3xl sm:text-4xl font-bold text-white">
              Complete With 7 Premium HR Management Modules
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#111726] border border-white/10 hover:border-amber-500/40 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Dope Personality Test Gatekeeper
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Periodic personality test and substance-free declaration every 6
                months to ensure staff discipline and service integrity.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#111726] border border-white/10 hover:border-amber-500/40 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                GPS & Selfie Attendance
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Clock in and clock out with location verification and selfie
                capture to ensure time accuracy.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#111726] border border-white/10 hover:border-amber-500/40 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Leave Management
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Annual, medical, and emergency leave applications with automatic
                balance tracking and status monitoring.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-[#111726] border border-white/10 hover:border-amber-500/40 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Digital Payslips
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Generate and download monthly payslips with accurate EPF, SOCSO,
                EIS, and tax (PCB) calculations.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-[#111726] border border-white/10 hover:border-amber-500/40 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Expense Claims
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Submit travel, medical, or equipment expense claims with
                transparent processing and tracking.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-[#111726] border border-white/10 hover:border-amber-500/40 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-110 transition-transform">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Evaluation & Performance
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Summary of work quality, teamwork, and discipline with the
                latest staff KPI scores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <section className="py-16 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/30 rounded-3xl p-8 sm:p-12 backdrop-blur-xl">
            <img
              src={YES_EMPIRE_LOGO}
              alt="YES EMPIRE"
              className="h-10 mx-auto mb-6 object-contain filter drop-shadow-[0_0_12px_rgba(217,119,6,0.5)]"
            />
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">
              Ready to Use the YES EMPIRE Staff Portal?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-8">
              Please log in using your official staff account or contact the
              administrator if you encounter any registration issues.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={hr.goToLogin}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/30 transition-all duration-200"
              >
                Log In Now
              </button>
              <button
                onClick={hr.goToRegister}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-all duration-200"
              >
                Register New Staff
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={YES_EMPIRE_LOGO}
              alt="YES EMPIRE"
              className="h-6 object-contain opacity-70"
            />
            <span>
              &copy; {new Date().getFullYear()} YES EMPIRE. All Rights Reserved.
            </span>
          </div>
          <div>HR Management System &middot; Staff Integrity Portal</div>
        </div>
      </footer>
    </div>
  );
}
