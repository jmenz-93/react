import { BookOpenIcon, FireIcon } from '../components/icons';
import BasicEconomics from '../components/basic_economics';
import RabbitLogo from '../components/rabbit';

const books = [
  {
    title: "Basic Economics",
    author: "Thomas Sowell",
    description: "Basic Economics is a citizen's guide to economics, written for those who want to understand how the economy works but have no interest in jargon or equations.",
    imageUrl: "/basic_economics.png"
  }
];

const cooking = [
  {
    title: "Rabbit Gnocchi Stew",
    description: "Hand-rolled tagliatelle with a slow-cooked bolognese sauce.",
    imageUrl: "/rabbit.png" // Store string, not component
  },
  {
    title: "Pumpkin Pasta",
    description: "Artisan sourdough loaf with a crispy crust and open crumb.",
    imageUrl: null, // Handle items without images gracefully
  },
  {
    title: "Spicy Ramen",
    description: "Rich tonkotsu broth with chashu pork and soft-boiled egg.",
    imageUrl: null
  }
];

export function Projects() {
  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Books Section */}
        <section className="mb-20">
          <div className="flex items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100/60 dark:bg-emerald-900/30">
              <BookOpenIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="ml-4 text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">What I'm Reading</h2>
          </div>
          <div className="space-y-6">
            {books.map((book) => (
              <article key={book.title} className="group bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row items-start gap-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600">
                {book.imageUrl && (
                  <div className="shrink-0 w-full sm:w-auto flex justify-center sm:justify-start">
                    <BasicEconomics imageUrl={book.imageUrl} altText={book.title} />
                  </div>
                )}
                <div className="flex-1 flex flex-col items-start justify-between w-full gap-2">
                  <div className="w-full">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">by {book.author}</p>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{book.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Cooking Section */}
        <section className="mb-20">
          <div className="flex items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100/60 dark:bg-orange-900/30">
              <FireIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="ml-4 text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">Kitchen Creations</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cooking.map((dish) => (
              <article key={dish.title} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-600 h-full flex flex-col group">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 transition-colors">{dish.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{dish.description}</p>
                    
                    {dish.imageUrl && (
                      <div className="flex justify-center w-full mt-4">
                        <RabbitLogo imageUrl={dish.imageUrl} altText={dish.title} />
                      </div>
                    )}
                    
                </div>
              </article>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

export default Projects;