import Avatar from './avatar';
import GitImage from './github';
import LinkedInImage from './linkedin';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from './theme_toggle';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/career_and_education' && location.pathname === '/') return true;
    return location.pathname === path;
  };

  const getLinkClass = (path: string) => 
    `px-4 py-1.5 text-sm font-medium rounded-full ${
      isActive(path) 
        ? 'bg-slate-200 text-slate-900 shadow-inner dark:bg-slate-700 dark:text-slate-100' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
    }`;

  return (
    <header className="w-full py-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-50 bg-white/80 backdrop-blur-md dark:bg-slate-900/80">
      <nav className="relative flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex-1 flex items-center justify-start">
          <Link to="/career_and_education" className="transition-transform hover:scale-105">
            <Avatar />
          </Link>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 shadow-sm rounded-full px-2 py-1.5 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
          <Link to="/career_and_education" className={getLinkClass('/career_and_education')}>Career & Education</Link>
          <Link to="/projects" className={getLinkClass('/projects')}>Hobbies & Projects</Link>
        </div>
        <div className="flex-1 flex items-center justify-end gap-4">
          <ThemeToggle />
          <GitImage
            imageUrl="/github-mark.png"
            linkUrl="https://github.com/jmenz-93"
            altText="Github"
          />
          <LinkedInImage
            imageUrl="/linkedin.png"
            linkUrl="https://www.linkedin.com/in/jon-menzel/"
            altText="LinkedIn"
            toolTip="Connect with me on LinkedIn"
          />
        </div>
      </nav>
  
      <div className="mt-4 flex md:hidden items-center justify-center gap-1 shadow-sm rounded-full px-2 py-1.5 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
        <Link to="/career_and_education" className={getLinkClass('/career_and_education')}>Career & Education</Link>
        <Link to="/projects" className={getLinkClass('/projects')}>Hobbies & Projects</Link>
      </div>
    </header>
  );
};

export default Navbar;

