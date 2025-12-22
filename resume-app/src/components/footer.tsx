const Footer = () => {
  return (
    <footer className="py-8 mt-auto bg-white/50 backdrop-blur-sm dark:bg-slate-900/50">
      <div className="text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          &copy; {new Date().getFullYear()} Jonathan Menzel. All rights reserved.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Built with React, TypeScript & Tailwind CSS
        </p>
      </div>
    </footer>
  );
};

export default Footer;