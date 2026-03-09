'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',     icon: '⬛' },
  { href: '/patients',     label: 'Patients',      icon: '👥' },
  { href: '/observations', label: 'Observations',  icon: '🔬' },
  { href: '/rules',        label: 'Rules',         icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 bg-[#0f4c81] text-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-5 border-b border-blue-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-[#00a896]">MT</span>
          <div>
            <p className="text-sm font-semibold leading-tight">MediTrack</p>
            <p className="text-xs text-blue-300 leading-tight">CDSS</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-white/20 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User badge (static for MVP) */}
      <div className="p-4 border-t border-blue-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#00a896] flex items-center justify-center text-xs font-bold">
            AS
          </div>
          <div>
            <p className="text-xs font-semibold">Dr. Anya Sharma</p>
            <p className="text-xs text-blue-300">Attending Physician</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
