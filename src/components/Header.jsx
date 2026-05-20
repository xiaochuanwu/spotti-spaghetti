import { useState, useEffect, useRef } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { useI18n } from '../i18n';
import appIcon from '../assets/images/favicon.png';

const themeOptions = [
  { value: 'system', emoji: '🖥️', key: 'theme.system' },
  { value: 'light',  emoji: '☀️', key: 'theme.light' },
  { value: 'dark',   emoji: '🌙', key: 'theme.dark' },
];

const langOptions = [
  { value: 'zh', emoji: '🇨🇳', key: 'lang.zh' },
  { value: 'en', emoji: '🇺🇸', key: 'lang.en' },
];

export const Header = ({ isLoggedIn, onLogout, themePreference, onSetTheme }) => {
  const { t, locale, changeLocale } = useI18n();
  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  
  const themeRef = useRef(null);
  const langRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setThemeOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    if (themeOpen || langOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [themeOpen, langOpen]);

  const currentTheme = themeOptions.find(o => o.value === themePreference) || themeOptions[0];
  const currentLang = langOptions.find(o => o.value === locale) || langOptions[0];

  return (
    <>
      {/* Sticky Glass Navigation Bar */}
      <nav className="fixed inset-x-0 top-0 z-50 select-none">
        <div className="h-[1px] bg-gradient-to-r from-transparent via-[#0071e3]/40 to-transparent" />
        
        <div className="h-11 bg-white/70 dark:bg-[#0a0a0c]/70 backdrop-blur-2xl backdrop-saturate-150 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between px-5 md:px-8">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2">
            <img 
              src={appIcon}
              alt=""
              aria-hidden="true"
              className="w-[18px] h-[18px] object-contain" 
            />
            <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-[13px] tracking-[-0.01em]">
              {t('nav.brand')}
            </span>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {/* Language Dropdown */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => {
                  setLangOpen(!langOpen);
                  setThemeOpen(false);
                }}
                aria-label={t('lang.label')}
                className="h-7 flex items-center gap-1 px-2 rounded-md text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-200 cursor-pointer active:scale-95"
              >
                <span className="text-[13px] leading-none">{currentLang.emoji}</span>
                <span className="text-[11px] font-medium tracking-tight hidden sm:inline">{t(currentLang.key)}</span>
                <ChevronDown size={10} className={`transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Language Dropdown Panel */}
              {langOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden animate-fade-in py-1">
                  <div className="px-3 pt-1.5 pb-1">
                    <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest">{t('lang.label')}</span>
                  </div>
                  {langOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        changeLocale(option.value);
                        setLangOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                        locale === option.value
                          ? 'text-[#0071e3] bg-[#0071e3]/[0.06]'
                          : 'text-[#1d1d1f] dark:text-[#e5e5e7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-[14px] leading-none w-5 text-center">{option.emoji}</span>
                      <span>{t(option.key)}</span>
                      {locale === option.value && (
                        <span className="ml-auto text-[#0071e3] text-[11px]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-3.5 bg-black/[0.08] dark:bg-white/[0.08]" />

            {/* Theme Dropdown */}
            <div className="relative" ref={themeRef}>
              <button
                onClick={() => {
                  setThemeOpen(!themeOpen);
                  setLangOpen(false);
                }}
                aria-label={t('theme.label')}
                className="h-7 flex items-center gap-1 px-2 rounded-md text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all duration-200 cursor-pointer active:scale-95"
              >
                <span className="text-[13px] leading-none">{currentTheme.emoji}</span>
                <span className="text-[11px] font-medium tracking-tight hidden sm:inline">{t(currentTheme.key)}</span>
                <ChevronDown size={10} className={`transition-transform duration-200 ${themeOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Theme Dropdown Panel */}
              {themeOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden animate-fade-in py-1">
                  <div className="px-3 pt-1.5 pb-1">
                    <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest">{t('theme.label')}</span>
                  </div>
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSetTheme(option.value);
                        setThemeOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[12px] font-medium transition-colors duration-150 cursor-pointer ${
                        themePreference === option.value
                          ? 'text-[#0071e3] bg-[#0071e3]/[0.06]'
                          : 'text-[#1d1d1f] dark:text-[#e5e5e7] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-[14px] leading-none w-5 text-center">{option.emoji}</span>
                      <span>{t(option.key)}</span>
                      {themePreference === option.value && (
                        <span className="ml-auto text-[#0071e3] text-[11px]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Logout */}
            {isLoggedIn && (
              <>
                <div className="w-px h-3.5 bg-black/[0.08] dark:bg-white/[0.08]" />
                <button 
                  onClick={onLogout}
                  className="flex items-center gap-1 text-[#6e6e73] hover:text-[#ff3b30] dark:text-[#a1a1a6] dark:hover:text-[#ff453a] text-xs font-medium tracking-tight cursor-pointer transition-colors duration-200 active:opacity-75 px-1.5 py-1 rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                >
                  <LogOut size={11} strokeWidth={2} />
                  <span>{t('nav.logout')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Display Section */}
      <header 
        role="banner" 
        className="w-full pt-20 pb-8 text-center select-none animate-fade-in-down"
      >
        <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.03em] text-[#1d1d1f] dark:text-[#f5f5f7] mb-3 leading-[1.05]">
          {t('hero.title')}
        </h1>
        
        <p className="text-[15px] md:text-base text-[#6e6e73] dark:text-[#a1a1a6] font-normal max-w-md mx-auto leading-relaxed tracking-[-0.01em]">
          {t('hero.subtitle.line1')}<br/>
          {t('hero.subtitle.line2')}
        </p>

      </header>
    </>
  );
};
