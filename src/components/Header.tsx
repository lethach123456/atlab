import { mobileMonthFilterId } from './MonthFilter';
import React, { useState } from 'react';
import { SettingsSubTab } from './SettingsView';
import {
  LayoutDashboard,
  DollarSign,
  ChartNoAxesCombined,
  FileSpreadsheet,
  CreditCard,
  Wallet,
  Truck,
  Settings,
  Plus,
  Menu,
  X,
  ChevronDown,
  Building2,
  Stethoscope,
  Layers,
  ShieldCheck,
  Search,
  Sun,
  Moon,
  Users,
  Percent,
  BadgeDollarSign,
  LogOut,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'revenue'
  | 'profit'
  | 'orders'
  | 'debt'
  | 'cashflow'
  | 'delivery'
  | 'payroll'
  | 'settings';

interface HeaderProps {
  activeTab: NavTab;
  isAdmin: boolean;
  readOnly?: boolean;
  userName: string;
  onSignOut: () => void;
  settingsSubTab: SettingsSubTab;
  onTabChange: (tab: NavTab, subTab?: SettingsSubTab) => void;
  onNewOrder: () => void;
  onOpenCommandPalette: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isAdmin,
  readOnly = false,
  userName,
  onSignOut,
  settingsSubTab,
  onTabChange,
  onNewOrder,
  onOpenCommandPalette,
  isDark,
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);

  const mainNavItems = [
    { id: 'dashboard' as NavTab, label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'revenue' as NavTab, label: 'Doanh thu', icon: DollarSign },
    { id: 'orders' as NavTab, label: 'Đơn hàng', icon: FileSpreadsheet },
    { id: 'debt' as NavTab, label: 'Công nợ', icon: CreditCard },
    { id: 'cashflow' as NavTab, label: 'Thu chi', icon: Wallet },
    { id: 'delivery' as NavTab, label: 'Giao vận', icon: Truck },
    ...(isAdmin ? [
      { id: 'profit' as NavTab, label: 'Lợi nhuận', icon: ChartNoAxesCombined },
      { id: 'payroll' as NavTab, label: 'Bảng lương', icon: BadgeDollarSign },
    ] : []),
  ];

  const settingsSubItems = [
    { id: 'clinics' as SettingsSubTab, label: 'Đối tác Nha khoa', icon: Building2 },
    { id: 'fdichart' as SettingsSubTab, label: 'Sơ đồ răng FDI', icon: Stethoscope },
    { id: 'materials' as SettingsSubTab, label: 'Vật liệu & Bảng giá', icon: Layers },
    { id: 'warranty' as SettingsSubTab, label: 'Tra cứu bảo hành', icon: ShieldCheck },
    { id: 'profile' as SettingsSubTab, label: 'Cấu hình Labo', icon: Settings },
    ...(isAdmin ? [{ id: 'payroll' as SettingsSubTab, label: 'Bảng lương nhân viên', icon: BadgeDollarSign }] : []),
    ...(isAdmin ? [{ id: 'commissions' as SettingsSubTab, label: 'Hoa hồng sale', icon: Percent }] : []),
    ...(isAdmin ? [{ id: 'users' as SettingsSubTab, label: 'Người dùng', icon: Users }] : []),
  ];

  return (
    <header className="no-print sticky top-2 z-40 px-3 sm:px-5 lg:px-6 pt-1">
      <div className="bento-card rounded-2xl px-3.5 sm:px-5">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Futuristic AT Emblem */}
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0 group"
            onClick={() => onTabChange('dashboard')}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center font-display font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.35)] group-hover:scale-105 transition-transform">
              AT
            </div>
            <div className="leading-none flex items-center gap-1.5">
              <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white">
                AT DENTAL
              </span>
              <span className="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-sky-400 border border-blue-500/20 rounded-md">
                OS 26
              </span>
            </div>
          </div>

          {/* Center Spatial Pill Dock */}
          <nav className="hidden xl:flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-950/70 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setSettingsDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_3px_12px_rgba(37,99,235,0.3)] font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-sky-200' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Settings Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setSettingsDropdownOpen(true)}
              onMouseLeave={() => setSettingsDropdownOpen(false)}
            >
              <button
                onClick={() => {
                  onTabChange('settings', !isAdmin && (settingsSubTab === 'users' || settingsSubTab === 'commissions' || settingsSubTab === 'payroll') ? 'clinics' : settingsSubTab);
                  setSettingsDropdownOpen(true);
                }}
                aria-expanded={settingsDropdownOpen}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'settings'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_3px_12px_rgba(37,99,235,0.3)] font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/60'
                }`}
              >
                <Settings
                  className={`w-3.5 h-3.5 ${
                    activeTab === 'settings' ? 'text-sky-200' : 'text-slate-400'
                  }`}
                />
                <span>Cài đặt</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {settingsDropdownOpen && (
                <div className="absolute right-0 top-full z-50 w-52 pt-1.5">
                  <div className="bento-card rounded-xl py-1.5">
                    {settingsSubItems.map((sub) => {
                      const SubIcon = sub.icon;
                      const isSubActive =
                        activeTab === 'settings' && settingsSubTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            onTabChange('settings', sub.id);
                            setSettingsDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-left transition-colors cursor-pointer ${
                            isSubActive
                              ? 'bg-blue-500/10 text-blue-600 dark:text-sky-400 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          <SubIcon className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Right Quick Controls */}
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onSignOut} title={userName}
              className="hidden sm:flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
              <LogOut className="size-3.5" aria-hidden="true" /> Đăng xuất
            </button>
            <button
              onClick={onOpenCommandPalette}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-slate-100/80 dark:bg-slate-950/70 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 rounded-xl text-xs transition-colors cursor-pointer"
              title="Tìm nhanh (Ctrl + K)"
            >
              <Search className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline font-medium">Tìm nhanh</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.2 text-[10px] font-mono bg-white dark:bg-slate-900 text-slate-500 rounded border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>

            <button
              onClick={onToggleTheme}
              className="hidden sm:block p-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-950/70 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 transition-colors cursor-pointer"
              title="Đổi giao diện Sáng / Tối"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <div id={mobileMonthFilterId} className="sm:hidden" />

            {readOnly ? (
              <span className="hidden sm:inline px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl whitespace-nowrap">
                Chế độ chỉ xem
              </span>
            ) : (
              <button
                onClick={onNewOrder}
                aria-label="Đơn mới"
                className="hidden sm:flex items-center justify-center gap-1 sm:px-3.5 sm:py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-[0_4px_12px_rgba(37,99,235,0.28)] transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đơn mới</span>
              </button>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={mobileMenuOpen}
              className="flex size-11 items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl xl:hidden"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain mt-1.5 bento-card rounded-2xl px-4 py-3 space-y-1">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full min-h-11 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-1">
            {settingsSubItems.map((sub) => {
              const SubIcon = sub.icon;
              return (
                <button
                  key={sub.id}
                  onClick={() => {
                    onTabChange('settings', sub.id);
                    setMobileMenuOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <SubIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate">{sub.label}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 sm:hidden dark:border-slate-800">
            <button type="button" onClick={() => { setMobileMenuOpen(false); onOpenCommandPalette(); }} className="flex min-h-11 items-center justify-center gap-1 rounded-lg text-xs text-slate-700 dark:text-slate-300"><Search aria-hidden="true" className="size-4" />Tìm kiếm</button>
            <button type="button" onClick={onToggleTheme} className="flex min-h-11 items-center justify-center gap-1 rounded-lg text-xs text-slate-700 dark:text-slate-300">{isDark ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}Giao diện</button>
            <button type="button" onClick={onSignOut} className="flex min-h-11 items-center justify-center gap-1 rounded-lg text-xs text-slate-700 dark:text-slate-300"><LogOut aria-hidden="true" className="size-4" />Đăng xuất</button>
          </div>
        </div>
      )}
    </header>
  );
};
