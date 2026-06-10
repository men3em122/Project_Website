'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Satellite,
  LayoutDashboard,
  ImagePlus,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { useCurrentUser, useSignOut } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const signOut = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = () => {
    signOut();
    router.push('/');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { href: '/annotate', label: 'Annotate', icon: <ImagePlus size={16} /> },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
        scrolled
          ? 'bg-[rgba(3,7,18,0.95)] backdrop-blur-xl border-b border-[#21262d] shadow-lg shadow-black/20'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[rgba(88,166,255,0.15)] border border-[rgba(88,166,255,0.3)] flex items-center justify-center group-hover:glow-blue transition-all">
              <Satellite size={18} className="text-[#58a6ff]" />
            </div>
            <span className="font-bold text-[#e6edf3] text-lg tracking-tight">
              Orbit<span className="gradient-text">Annotate</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    isActive(link.href)
                      ? 'bg-[rgba(88,166,255,0.15)] text-[#58a6ff] border border-[rgba(88,166,255,0.2)]'
                      : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22]'
                  )}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-[#161b22] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#58a6ff] to-[#bc8cff] flex items-center justify-center text-xs font-bold text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-[#e6edf3] capitalize font-medium hidden sm:block max-w-[120px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn('text-[#8b949e] transition-transform', profileOpen && 'rotate-180')}
                  />
                </button>
                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 glass-card rounded-xl border border-[#21262d] shadow-xl z-20 overflow-hidden fade-in">
                      <div className="px-4 py-3 border-b border-[#21262d]">
                        <p className="text-sm font-semibold text-[#e6edf3] truncate capitalize">{user.name}</p>
                        <p className="text-xs text-[#8b949e] truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          href="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                        >
                          <User size={15} />
                          Profile
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#f85149] hover:bg-[#21262d] transition-colors"
                        >
                          <LogOut size={15} />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/auth/signin"
                  className="text-sm font-medium text-[#8b949e] hover:text-[#e6edf3] px-3 py-2 rounded-lg hover:bg-[#161b22] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm font-semibold bg-[#58a6ff] text-[#0d1117] px-4 py-2 rounded-lg hover:bg-[#79c0ff] transition-colors shadow-[0_0_12px_rgba(88,166,255,0.3)]"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            {user && (
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors"
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {user && menuOpen && (
          <div className="md:hidden border-t border-[#21262d] py-3 space-y-1 fade-in">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive(link.href)
                    ? 'bg-[rgba(88,166,255,0.15)] text-[#58a6ff]'
                    : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22]'
                )}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
