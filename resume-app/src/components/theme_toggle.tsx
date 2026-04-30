import { useTheme } from '../theme/ThemeProvider';

export default function ThemeToggle() {
  const { isDark, setThemeMode } = useTheme();

  return (
    <label className="inline-flex items-center gap-2 group cursor-pointer">
      <span className="sr-only">Toggle dark mode</span>

      <input
        type="checkbox"
        className="sr-only peer"
        checked={isDark}
        onChange={(e) => setThemeMode(e.target.checked ? 'dark' : 'light')}
        aria-label="Toggle dark mode"
      />

      {/* Icon on the LEFT (always shows; swaps based on state) */}
      <span className="inline-flex items-center justify-center w-5 text-slate-500 dark:text-slate-300 pointer-events-none">
        {isDark ? (
          // Moon
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12.79A8.5 8.5 0 1111.21 3a6.5 6.5 0 009.79 9.79z"
            />
          </svg>
        ) : (
          // Sun
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        )}
      </span>

      {/* Switch */}
      <span
        className="
          w-14 h-8 flex items-center flex-shrink-0 p-1
          bg-slate-300 rounded-full
          duration-300 ease-in-out
          peer-checked:bg-slate-900
          dark:bg-slate-700 dark:peer-checked:bg-slate-200
          after:w-6 after:h-6 after:bg-white after:rounded-full after:shadow-md after:duration-300
          dark:after:bg-slate-900
          peer-checked:after:translate-x-6
          group-hover:after:translate-x-1
        "
      />
    </label>
  );
}
