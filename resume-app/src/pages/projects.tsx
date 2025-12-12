import { BookOpenIcon, FireIcon } from '../components/icons';

const books = [
  {
    title: "Basic Economics",
    author: "Thomas Sowell",
    status: "Reading",
    description: "A common-sense guide to how the economy works, explaining the principles underlying different economic systems.",
    color: "bg-emerald-100 text-emerald-800",
    imageUrl: "https://target.scene7.com/is/image/Target/GUEST_c22f0926-33c3-4bdf-99a8-9c6dd9701f25?wid=1200&hei=1200&qlt=80"
  }
];

const cooking = [
  {
    title: "Homemade Pasta",
    description: "Hand-rolled tagliatelle with a slow-cooked bolognese sauce.",
    tags: ["Italian", "Dinner", "Homemade"]
  },
  {
    title: "Sourdough Bread",
    description: "Artisan sourdough loaf with a crispy crust and open crumb.",
    tags: ["Baking", "Bread", "Fermentation"]
  },
  {
    title: "Spicy Ramen",
    description: "Rich tonkotsu broth with chashu pork and soft-boiled egg.",
    tags: ["Japanese", "Soup", "Comfort Food"]
  }
];

export function Projects() {
  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Books Section */}
        <section className="mb-20">
          <div className="flex items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100/60">
              <BookOpenIcon className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="ml-4 text-sm font-bold uppercase tracking-widest text-slate-600">What I'm Reading</h2>
          </div>
          <div className="space-y-6">
            {books.map((book) => (
              <article key={book.title} className="group bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start gap-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300">
                {book.imageUrl && (
                  <div className="shrink-0 w-full sm:w-auto flex justify-center sm:justify-start">
                    <img 
                      src={book.imageUrl} 
                      alt={book.title} 
                      className="w-40 h-auto object-contain rounded shadow-md transform group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="flex-1 flex flex-col items-start justify-between w-full gap-2">
                  <div className="w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{book.title}</h3>
                        <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${book.color}`}>
                            {book.status}
                        </span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-4">by {book.author}</p>
                    <p className="text-slate-600 leading-relaxed">{book.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Cooking Section */}
        <section>
          <div className="flex items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100/60">
              <FireIcon className="h-6 w-6 text-orange-600" />
            </div>
            <h2 className="ml-4 text-sm font-bold uppercase tracking-widest text-slate-600">Culinary Adventures</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cooking.map((dish) => (
              <article key={dish.title} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 h-full flex flex-col group">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">{dish.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{dish.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {dish.tags.map(tag => (
                    <span key={tag} className="px-2 py-1 text-xs font-medium text-orange-800 bg-orange-50 rounded-md border border-orange-100">
                      {tag}
                    </span>
                  ))}
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