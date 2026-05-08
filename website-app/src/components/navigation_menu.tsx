import Avatar from './avatar';
import GitImage from './github';
import LinkedInImage from './linkedin';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <header className="w-full py-5 px-4 sm:px-6 lg:px-8">
      <nav className="relative flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex-1 flex items-center justify-start">
          <Link to="/career_and_education" className="transition-transform hover:scale-105">
            <Avatar />
          </Link>
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-2 shadow-lg rounded-full px-4 py-2 bg-white/70 dark:bg-neutral-800/70 backdrop-blur-sm border border-slate-200/80 dark:border-neutral-700/80">
          <Link to="/career_and_education" className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-full transition-colors hover:bg-gray-200/50 dark:hover:bg-neutral-700/50">Career & Education</Link>
          <Link to="/projects" className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-full transition-colors hover:bg-gray-200/50 dark:hover:bg-neutral-700/50">Hobbies & Projects</Link>
        </div>
        <div className="flex-1 flex items-center justify-end gap-4">
          <GitImage
            imageUrl="/github-mark.png"
            linkUrl="https://github.com/jmenz-93"
            altText="Github"
            toolTip="Click to view my Git"
          />
          <LinkedInImage
            imageUrl="/linkedin.png"
            linkUrl="https://www.linkedin.com/in/jon-menzel/"
            altText="LinkedIn"
            toolTip="Connect with me on LinkedIn"
          />
        </div>
      </nav>
  
      <div className="mt-6 flex md:hidden items-center justify-center gap-2 shadow-lg rounded-full px-3 py-2 bg-white/70 dark:bg-neutral-800/70 backdrop-blur-sm border border-slate-200/80 dark:border-neutral-700/80">
        <Link to="/career_and_education" className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-full transition-colors hover:bg-gray-200/50 dark:hover:bg-neutral-700/50">Career & Education</Link>
        <Link to="/projects" className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-full transition-colors hover:bg-gray-200/50 dark:hover:bg-neutral-700/50">Hobbies & Projects</Link>
      </div>
    </header>
  );
};

export default Navbar;

