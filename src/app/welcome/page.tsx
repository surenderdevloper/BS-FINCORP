import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export const metadata: Metadata = {
  title: "Home",
  description:
    "BS FINCORP — loan aur EMI management software. Customer, loan, EMI, collection, receipt aur report, sab ek hi jagah.",
};

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "dashboard",
    title: "Smart Dashboard",
    desc: "Total customer, active/closed loan, aaj ka collection, overdue EMI aur pending amount — ek nazar me.",
  },
  {
    icon: "users",
    title: "Customer + KYC",
    desc: "Naam, mobile, address, Aadhaar/PAN aur documents upload & print, sab ek jagah.",
  },
  {
    icon: "calendar",
    title: "Loan & Auto EMI",
    desc: "Gaadi ki detail, down payment, flat ya reducing interest aur tenure — EMI schedule khud ban jata hai.",
  },
  {
    icon: "cash",
    title: "Collection / EMI Pay",
    desc: "Cash ya online, aadhi EMI (partial) bhi. Extra paisa agle EMI me advance banke save ho jata hai.",
  },
  {
    icon: "close",
    title: "Discount se Loan Close",
    desc: "Mauka dekh kar discount dein aur loan turant band karein — poora hisaab saaf.",
  },
  {
    icon: "print",
    title: "Receipt / Statement / NOC",
    desc: "Har payment ka receipt aur poora statement — turant print ya WhatsApp par bhejein.",
  },
  {
    icon: "rules",
    title: "Late Penalty Auto",
    desc: "Aap rule set karein — kitna aur din ka kitna — penalty khud lag jaye.",
  },
  {
    icon: "reports",
    title: "Reports & Backup",
    desc: "Collection aur loan report Excel me download, aur poore data ka safe backup.",
  },
];

const WHY: string[] = [
  "Advance + partial payment support",
  "Discount se loan close",
  "Free WhatsApp / SMS reminder",
  "Mobile + computer, ek hi data",
  "Staff ke liye alag login",
  "Cloud par data surakshit",
  "Aapke business ke naam se branded",
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-sm font-extrabold tracking-tight text-white">
              BS
            </span>
            <span className="text-lg font-extrabold tracking-wide text-zinc-900">BS FINCORP</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex">
            <a className="transition-colors hover:text-emerald-700" href="#features">
              Features
            </a>
            <a className="transition-colors hover:text-emerald-700" href="#why">
              Kyun Hum
            </a>
            <a className="transition-colors hover:text-emerald-700" href="#demo">
              Demo
            </a>
          </nav>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Login
            <Icon name="chevron" size={16} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/70 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Loan &amp; EMI Management Software
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-zinc-900 sm:text-5xl">
              Aapke Finance Business ka{" "}
              <span className="text-emerald-600">Digital Munshi</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600">
              Gaadi / finance loan ka poora hisaab — customer, loan, EMI, collection, receipt aur report —
              ab ek hi simple app me. EMI schedule, bacha hua amount, late penalty aur WhatsApp reminder
              sab automatic.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <Icon name="view" size={18} />
                Live Demo Dekhein
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 text-sm font-semibold text-zinc-700 transition-colors hover:border-emerald-300 hover:text-emerald-700"
              >
                Features Dekhein
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600">
              {["Mobile + Computer", "Data cloud par safe", "Free WhatsApp reminder"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Icon name="check" size={16} className="text-emerald-600" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* App mockup */}
          <div className="relative">
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-emerald-900/5">
              <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 truncate rounded-md bg-zinc-100 px-3 py-1 text-[11px] text-zinc-500">
                  bsfincorp.app/dashboard
                </span>
              </div>
              <div className="space-y-3 p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Total Collection", value: "₹2,00,000", tone: "text-emerald-700" },
                    { label: "Pending Amount", value: "₹1,45,000", tone: "text-zinc-900" },
                    { label: "Overdue EMIs", value: "3", tone: "text-red-600" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{s.label}</p>
                      <p className={`mt-1 text-base font-bold ${s.tone}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-hidden rounded-xl border border-zinc-100">
                  <div className="grid grid-cols-3 bg-zinc-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    <span>Receipt</span>
                    <span>Customer</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {[
                    { r: "RCPT-0007", c: "Ramesh K.", a: "₹2,722" },
                    { r: "RCPT-0008", c: "Suresh P.", a: "₹2,722" },
                    { r: "RCPT-0009", c: "Mahesh S.", a: "₹5,444" },
                  ].map((row) => (
                    <div
                      key={row.r}
                      className="grid grid-cols-3 border-t border-zinc-50 px-3 py-2 text-xs text-zinc-700"
                    >
                      <span className="font-mono text-zinc-500">{row.r}</span>
                      <span className="font-medium text-zinc-800">{row.c}</span>
                      <span className="text-right font-semibold text-zinc-900">{row.a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-4 -right-3 hidden rotate-2 rounded-xl border border-emerald-100 bg-white px-4 py-2.5 shadow-lg sm:block">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Aaj ka collection</p>
              <p className="text-sm font-bold text-emerald-700">₹10,888</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">Ek App Me Poora Business</h2>
          <p className="mt-3 text-base text-zinc-600">
            Register, bikhri Excel files aur yaad rakhne wale reminders ki zarurat nahi — sab kuch ek jagah.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-100 bg-white p-5 transition-all hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/5"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Icon name={f.icon} size={20} />
              </span>
              <h3 className="mt-3.5 text-base font-bold text-zinc-900">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section id="why" className="scroll-mt-20 border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">
                Kyun BS FINCORP Best Hai
              </h2>
              <p className="mt-3 text-base leading-relaxed text-zinc-600">
                Aam loan apps me advance ya aadhi EMI ka support nahi hota. Yahan aapka poora business —
                jaise aap chalate hain — waisa hi digital ho jata hai.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {WHY.map((w) => (
                  <li key={w} className="flex items-start gap-2.5 text-sm font-medium text-zinc-700">
                    <Icon name="check" size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { v: "10+", l: "Modules ek app me" },
                { v: "100%", l: "Apne naam se branded" },
                { v: "Excel", l: "Report export" },
                { v: "24/7", l: "Cloud par available" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-zinc-100 bg-white p-5 text-center">
                  <p className="text-2xl font-extrabold text-emerald-600">{s.v}</p>
                  <p className="mt-1 text-xs font-medium text-zinc-500">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <div className="flex flex-col items-center justify-between gap-6 rounded-3xl bg-zinc-900 px-8 py-12 text-center sm:flex-row sm:text-left">
          <div>
            <h2 className="text-2xl font-extrabold text-white">10 minute ka free demo — aaj hi</h2>
            <p className="mt-2 max-w-lg text-sm text-zinc-300">
              Apne customer aur loan ka data daal kar khud dekhein. Pasand aaye tab aage baat.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
          >
            <Icon name="view" size={18} />
            Live Demo Kholen
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-extrabold text-white">
              BS
            </span>
            <span className="font-bold text-zinc-800">BS FINCORP</span>
            <span className="hidden sm:inline">— Aapka Business, Aapka Control.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="font-medium transition-colors hover:text-emerald-700">
              Login
            </Link>
            <a href="#features" className="font-medium transition-colors hover:text-emerald-700">
              Features
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
