"use client";

import { useState } from "react";
import Link from 'next/link';
import { LayoutDashboard, Users, Activity, Settings, PhoneCall, ListTodo, BarChart, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/leads", label: "Leads Data", icon: Users },
    { href: "/crm", label: "CRM Dialer", icon: PhoneCall },
    { href: "/crm/tasks", label: "Sales Tasks", icon: ListTodo },
    { href: "/crm/analytics", label: "Pipeline Stats", icon: BarChart },
    { href: "/jobs", label: "Job Queue", icon: Activity },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <nav className="border-b bg-card relative z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
          <Activity className="w-6 h-6 shrink-0" />
          <span>GBS Platform</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
            return (
              <Link 
                key={href} 
                href={href} 
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </Link>
            );
          })}
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="lg:hidden p-2 text-muted-foreground hover:text-primary focus:outline-none"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 w-full bg-card border-b shadow-lg flex flex-col p-4 space-y-2 z-50">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
            return (
              <Link 
                key={href} 
                href={href} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 text-base font-medium transition-colors p-3 rounded-lg ${isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-muted"}`}
              >
                <Icon className="w-5 h-5" /> {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
