import React from 'react';
import { Link } from 'react-router-dom';
import { XIcon } from '../components/icons';

export function ErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-24 sm:py-32 lg:px-8 text-center">
      <div className="rounded-full bg-red-100 p-4 mb-6">
         <XIcon className="h-10 w-10 text-red-600" />
      </div>
      <p className="text-base font-semibold text-indigo-600">404</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">Page not found</h1>
      <p className="mt-6 text-base leading-7 text-slate-600 max-w-md mx-auto">
        Whoops! It looks like you've ventured into the unknown. Let's get you back on track.
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Link
          to="/career_and_education"
          className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all hover:scale-105"
        >
          Go back home
        </Link>
      </div>
    </div>
  );
};

export default React.memo(ErrorPage);