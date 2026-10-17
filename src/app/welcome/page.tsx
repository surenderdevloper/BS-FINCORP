import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export const metadata: Metadata = {
  title: "Loan & EMI Management Software",
  description:
    "Gigabyte Finance Manager by Gigabyte Brothers — loan and EMI management software. Customers, loans, EMIs, collections, receipts and reports, all in one app.",
};

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: "dashboard",
    title: "Smart Dashboard",
    desc: "Total customers, active/closed loans, today's collection, overdue EMIs and pending amount — at a glance.",
  },
  {
    icon: "users",
    title: "Customer & KYC",
    desc: "Name, mobile, address, Aadhaar/PAN and document upload & print, all kept in one place.",
  },
  {
    icon: "calendar",
    title: "Loans & Auto EMI",
    desc: "Vehicle details, down payment, flat or reducing interest and tenure — the EMI schedule is generated automatically.",
  },
  {
    icon: "cash",
    title: "Collections / EMI Pay",
    desc: "Cash or online, partial EMI allowed. Any extra amount is saved as advance credit for the next EMI.",
  },
  {
    icon: "close",
    title: "Close Loan with Discount",
    desc: "Give a discount whenever you choose and close the loan instantly — the full account stays clean.",
  },
  {
    icon: "print",
    title: "Receipt / Statement / NOC",
    desc: "A receipt for every payment and the full statement — print or share on WhatsApp instantly.",
  },
  {
    icon: "rules",
    title: "Automatic Late Penalty",
    desc: "Set your own rule — how much, per day — and the penalty is applied automatically.",
  },
  {
    icon: "reports",
    title: "Reports & Backup",
    desc: "Collection and loan reports exported to Excel, plus a safe backup of all your data.",
  },
];

const WHY: string[] = [
  "Advance + partial payment support",
  "Close loans with a discount",
  "Free WhatsApp / SMS reminders",
  "Mobile + computer, same data",
  "Separate login for staff",
  "Data safe in the cloud",
  "Branded with your business name",
];

const PRICING: {
  term: string;
  price: string;
  trial: string;
  badge?: string;
  highlight?: boolean;
  perks: string[];
}[] = [
  {
    term: "3 Months",
    price: "₹349",
    trial: "3-day free trial",
    perks: [
      "All modules included",
      "Unlimited customers & loans",
      "Receipts, statements & NOC",
      "WhatsApp / SMS reminders",
      "Excel reports & cloud backup",
    ],
  },
  {
    term: "6 Months",
    price: "₹649",
    trial: "7-day free trial",
    badge: "Most Popular",
    highlight: true,
    perks: [
      "Everything in 3 Months",
      "Priority support",
      "Unlimited customers & loans",
      "Receipts, statements & NOC",
      "Excel reports & cloud backup",
    ],
  },
  {
    term: "1 Year",
    price: "₹1,299",
    trial: "7-day free trial",
    badge: "Best Value",
    perks: [
      "Everything in 6 Months",
      "Free data migration",
      "Priority support",
      "Receipts, statements & NOC",
      "Excel reports & cloud backup",
    ],
  },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-xs font-extrabold tracking-tight text-white">
              GFM
            </span>
            <span className="text-base font-extrabold tracking-wide text-zinc-900 sm:text-lg">
              <span className="sm:hidden">GFM</span>
              <span className="hidden sm:inline">Gigabyte Finance Manager</span>
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-600 md:flex">
            <a className="transition-colors hover:text-emerald-700" href="#features">
              Features
            </a>
            <a className="transition-colors hover:text-emerald-700" href="#about">
              About Us
            </a>
            <a className="transition-colors hover:text-emerald-700" href="#pricing">
              Pricing
            </a>
            <a className="transition-colors hover:text-emerald-700" href="#contact">
              Contact Us
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
              Your Finance Business, <span className="text-emerald-600">Made Simple</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600">
              Every detail of your vehicle / finance loans — customers, loans, EMIs, collections, receipts
              and reports — in one simple app. EMI schedules, dues, late penalties and WhatsApp reminders,
              all handled automatically.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <Icon name="view" size={18} />
                View Live Demo
              </Link>
              <a
                href="#features"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 text-sm font-semibold text-zinc-700 transition-colors hover:border-emerald-300 hover:text-emerald-700"
              >
                See Features
              </a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600">
              {["Mobile + Computer", "Data safe in the cloud", "Free WhatsApp reminders"].map((t) => (
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
                  gfm.app/dashboard
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
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Today&apos;s collection</p>
              <p className="text-sm font-bold text-emerald-700">₹10,888</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">Your Whole Business in One App</h2>
          <p className="mt-3 text-base text-zinc-600">
            No more registers, scattered Excel files or reminders you have to remember — everything in one place.
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

      {/* About Us */}
      <section id="about" className="scroll-mt-20 border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">About Us</h2>
            <p className="mt-3 text-base text-zinc-600">Who we are, and what this software does for you.</p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-white p-7">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-sm font-extrabold text-white">
                GB
              </span>
              <h3 className="mt-4 text-xl font-bold text-zinc-900">Gigabyte Brothers</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                Gigabyte Brothers is a web, branding and social media studio from Sri Ganganagar. We build
                websites, WordPress and e-commerce stores, business logos, visiting cards and templates,
                and we handle social media and video editing for local businesses.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                We help businesses take their work online — cleanly, affordably and in a way that actually
                makes day-to-day work easier.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white p-7">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Icon name="dashboard" size={22} />
              </span>
              <h3 className="mt-4 text-xl font-bold text-zinc-900">Gigabyte Finance Manager — the software</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                Gigabyte Finance Manager is our loan and EMI management software made for finance and vehicle-loan
                businesses. It keeps your entire business in one place — customers, loans, EMI schedules,
                collections, receipts and reports.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                It supports partial and advance payments, discount-based loan closing, automatic late
                penalties and WhatsApp / SMS reminders, so your daily recovery work becomes simple and
                organised.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="why" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">Why Choose Gigabyte Finance Manager</h2>
            <p className="mt-3 text-base leading-relaxed text-zinc-600">
              Most loan apps do not support advance payments or part payments. Here, your whole business —
              exactly the way you run it — becomes digital.
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
              { v: "10+", l: "Modules in one app" },
              { v: "100%", l: "Branded to your business" },
              { v: "Excel", l: "Report export" },
              { v: "24/7", l: "Available on the cloud" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-zinc-100 bg-white p-5 text-center">
                <p className="text-2xl font-extrabold text-emerald-600">{s.v}</p>
                <p className="mt-1 text-xs font-medium text-zinc-500">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">Simple, Honest Pricing</h2>
            <p className="mt-3 text-base text-zinc-600">
              Start with a free trial. No hidden charges, cancel anytime.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {PRICING.map((p) => (
              <div
                key={p.term}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 ${
                  p.highlight ? "border-emerald-500 shadow-lg shadow-emerald-900/10" : "border-zinc-200"
                }`}
              >
                {p.badge && (
                  <span
                    className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      p.highlight ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white"
                    }`}
                  >
                    {p.badge}
                  </span>
                )}
                <h3 className="text-base font-bold text-zinc-900">{p.term}</h3>
                <p className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-zinc-900">{p.price}</span>
                  <span className="pb-1 text-sm text-zinc-500">/ {p.term.toLowerCase()}</span>
                </p>
                <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Icon name="check" size={14} /> {p.trial}
                </span>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5 text-sm text-zinc-600">
                      <Icon name="check" size={17} className="mt-0.5 shrink-0 text-emerald-600" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-6 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                    p.highlight
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-zinc-300 bg-white text-zinc-800 hover:border-emerald-300 hover:text-emerald-700"
                  }`}
                >
                  Start Free Trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Us */}
      <section id="contact" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <div className="rounded-3xl bg-zinc-900 px-8 py-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold text-white">Contact Us</h2>
            <p className="mt-3 text-sm text-zinc-300">
              Ready for a demo or have a question? Reach out to Gigabyte Brothers — we will get back to you.
            </p>
          </div>
          <div className="mx-auto mt-9 grid max-w-3xl gap-4 sm:grid-cols-2">
            <a
              href="https://gigabytebrothers.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-emerald-400/40 hover:bg-white/10"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <Icon name="view" size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium uppercase tracking-wide text-zinc-400">Website</span>
                <span className="block truncate text-sm font-semibold text-white">
                  gigabytebrothers.vercel.app
                </span>
              </span>
            </a>
            <a
              href="mailto:gigabytebrothers4@gmail.com"
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-emerald-400/40 hover:bg-white/10"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <Icon name="chat" size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium uppercase tracking-wide text-zinc-400">Email</span>
                <span className="block truncate text-sm font-semibold text-white">
                  gigabytebrothers4@gmail.com
                </span>
              </span>
            </a>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              <Icon name="view" size={18} />
              Open Live Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-extrabold text-white">
              GFM
            </span>
            <span className="font-bold text-zinc-800">Gigabyte Finance Manager</span>
            <span className="hidden sm:inline">— by Gigabyte Brothers, Sri Ganganagar.</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#about" className="font-medium transition-colors hover:text-emerald-700">
              About Us
            </a>
            <a href="#pricing" className="font-medium transition-colors hover:text-emerald-700">
              Pricing
            </a>
            <Link href="/login" className="font-medium transition-colors hover:text-emerald-700">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
