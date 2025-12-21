import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/navigation_menu';
import Footer from './components/footer';
import Career from './pages/career_and_education';
import Projects from './pages/projects';
import { ErrorPage } from './pages/error_page';


function App() {
  return (
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
          <div className="container mx-auto flex-1 flex flex-col sm:px-6 md:px-8 lg:px-12 xl:px-16 sm:max-w-md md:max-w-lg lg:max-w-4xl xl:max-w-7xl">
            <main className="flex-1 border border-gray-200 dark:border-slate-700 shadow-xl bg-white dark:bg-slate-900 flex flex-col">
              <Navbar />
              <div className="flex-1">
                <Routes>
                  <Route path="/" element={<Career />} />
                  <Route path="/career_and_education" element={<Career />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="*" element={<ErrorPage />} />
                </Routes>
              </div>
              <Footer />
            </main>
          </div>
        </div>
      </BrowserRouter>
  );
}

export default App;
