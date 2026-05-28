import { useI18n } from '../i18n';

export const Footer = () => {
  const { t } = useI18n();
  return (
    <footer 
      className="w-full shrink-0 text-center mt-auto py-5 px-4 border-t border-[#e5e5e7] dark:border-[#282828] select-none text-neutral-400 dark:text-neutral-500 md:py-6"
      role="contentinfo"
    >
      <p className="text-xs tracking-wider">
        &copy; {new Date().getFullYear()} Spotti Spaghetti. {t('footer.rights')}
      </p>
    </footer>
  );
};
