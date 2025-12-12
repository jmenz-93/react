import MUImage from '../components/mu';
import UWMImage from '../components/uwm';
import AWSAIImage from '../components/aws_ai_badge';
import ComptiaImage from '../components/comptia';
import NMLogo from '../components/nm';
import { BriefcaseIcon, AcademicCapIcon, SparklesIcon } from '../components/icons';

const educationDetails = {
    uwm: {
        title: "University of Wisconsin-Milwaukee",
        degree: "Bachelor's in Information Science & Technology",
        logo: <UWMImage imageUrl="/uwm.png" linkUrl="https://uwm.edu/" altText="UWM"/>,
        info: [
            { label: "Graduated", value: "May 2017"},
            { label: "GPA", value: "3.8 / 4.0" }
        ],
    },
    mu: {
        title: "Marquette University",
        degree: "Master's in Computer and Information Science",
        logo: <MUImage imageUrl="/mu.png" linkUrl="https://www.marquette.edu/" altText="MU" />,
        info: [
            { label: "Anticipated Graduation", value: "December 2026"},
            { label: "GPA", value: "3.8 / 4.0" }
        ],
    },
};

const workExperience = [
  {
    id: "nm-se-iii",
    title: "Software Engineer III, Northwestern Mutual",
    dates: "2024 - Present",
    isCurrent: true,
    duties: [
      "Developed dbt models in Snowflake.",
      "Implemented infrastructure-as-code with Terraform.",
      "Optimized Control-M scheduled pipelines for cost & performance.",
      "Partnered with product stakeholders to refine data requirements."
    ],
    technologies: ["Snowflake", "dbt", "Python","Control-M", "AWS", "CI/CD", "Terraform"],
    imageUrl: "/nm.png"
  },
  {
    id: "nm-se-ii",
    title: "Software Engineer II, Northwestern Mutual",
    dates: "2021 - 2024",
    isCurrent: false,
    duties: [
      "Built fact & dimension models in Databricks (PII-compliant).",
      "Collaborated with business users to gather and refine requirements.",
      "Authored SSRS and Power BI reports for Wealth stakeholders."
    ],
    technologies: ["Databricks", "SQL","Python", "Airflow", "CI/CD"],
    imageUrl: "/nm.png"
  },
  {
    id: "nm-se-i",
    title: "Software Engineer I, Northwestern Mutual",
    dates: "2019 - 2021",
    isCurrent: false,
    duties: [
      "Engineered Netezza datasets sourcing from DB2.",
      "Maintained ETL packages (SSIS) supporting reporting workloads."
    ],
    technologies: ["SQL", "Netezza", "SSIS", "SQL Server"],
    imageUrl: "/nm.png"
  }
];


export function Career() {

  return (
      <div className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="sr-only">Career & Education</h1>

          {/* Hero Section */}
          <section className="mb-20 text-center pt-8">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
              Hi, I'm Jonathan.
            </h2>
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto font-light">
                I'm a Software Engineer in Milwaukee, WI, working at Northwestern Mutual where I build data models and technologies on Snowflake for investment data. I'm currently pursuing my Master's in Computer and Information Science at Marquette University, with an anticipated graduation in December 2026. Analytical by nature, I'm always looking to grow—whether through coursework, online learning, or hands-on projects. Outside of work, I love cooking and reading non-fiction books. Check out my hobbies section to see what I'm currently reading and whipping up in the kitchen!
            </p>
          </section>

        {/* Work Experience */}
        <section className="mb-20">
          <div className="flex items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100/60">
                <BriefcaseIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="ml-4 text-sm font-bold uppercase tracking-widest text-slate-600">Work Experience</h2>
          </div>
          <div className="relative ml-6 border-l-2 border-slate-300 pl-8 py-2">
            {workExperience.map(job => (
              <div key={job.id} className="relative mb-12">
                <span className={`absolute -left-[2.6rem] top-6 h-5 w-5 rounded-full border-4 border-white ${job.isCurrent ? 'bg-blue-600 ring-2 ring-blue-100' : 'bg-slate-400 ring-2 ring-slate-100'}`} />
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 group">
                  <div className="flex items-center mb-4">
                    <NMLogo imageUrl={job.imageUrl} linkUrl='https://www.northwesternmutual.com/' altText={`${job.title} logo`} />
                    <div className="ml-4">
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{job.title}</h3>
                      <p className="text-sm font-medium text-slate-500">{job.dates}</p>
                    </div>
                  </div>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed marker:text-slate-400">
                    {job.duties.map((duty) => <li key={duty}>{duty}</li>)}
                  </ul>
                  <div className="mt-6 pt-4 border-t border-slate-100">
                      <div className="flex flex-wrap gap-2">
                        {job.technologies.map(tech => (
                          <span key={tech} className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-md border border-blue-100">
                            {tech}
                          </span>
                        ))}
                      </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

          {/* --- Education Section --- */}
          <section className="mb-20">
            <div className="flex items-center mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100/60">
                <AcademicCapIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <h2 className="ml-4 text-sm font-bold uppercase tracking-widest text-slate-600">Education</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {Object.entries(educationDetails).map(([key, details]) => (
                <article key={key} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 group h-full flex flex-col">
                  <div className="flex items-center mb-4">
                    <div className="mr-4 flex-shrink-0">
                      {details.logo}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{details.title}</h3>
                      <p className="text-sm text-slate-500">{details.degree}</p>
                    </div>
                  </div>
                  <div className="mt-auto pt-4 border-t border-slate-100 space-y-2">
                     {details.info.map(item => (
                       <div key={item.label} className="flex flex-col sm:flex-row sm:justify-between text-sm">
                         <span className="text-slate-500 font-medium">{item.label}:</span>
                         <span className="text-slate-700">{item.value}</span>
                       </div>
                     ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Certifications */}
          <section>
            <div className="flex items-center mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100/60">
                    <SparklesIcon className="h-6 w-6 text-amber-600" />
                </div>
                <h2 className="ml-4 text-sm font-bold uppercase tracking-widest text-slate-600">Certifications</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* AWS Card */}
                <article className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-all duration-300 h-full hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 group">
                    <div className="flex items-center">
                        <div className="mr-5 flex-shrink-0">
                            <AWSAIImage imageUrl="/aws-ai-pract.png" altText="AWS AI Practitioner Badge" linkUrl="https://www.credly.com/badges/79ea3f7e-5b24-4d93-beee-982818b32699/public_url" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">AWS Certified AI Practitioner</h3>
                            <p className="text-sm text-slate-500">Issued by Amazon Web Services</p>
                        </div>
                    </div>
                </article>

                {/* CompTIA Card */}
                <article className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-all duration-300 h-full hover:shadow-lg hover:-translate-y-1 hover:border-slate-300 group">
                    <div className="flex items-center">
                        <div className="mr-5 flex-shrink-0">
                            <ComptiaImage 
                              imageUrl="https://www.comptia.org/_next/image/?url=https%3A%2F%2Fimages.cmp.optimizely.com%2F8623b0fab71111efac96d615e91762a5&w=256&q=90" 
                              altText="CompTIA Security+ Logo" 
                              linkUrl="https://www.comptia.org/certifications/security" 
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-bold text-slate-800 group-hover:text-blue-600 transition-colors">CompTIA Security+</h3>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700 tracking-wide">Studying</span>
                            </div>
                            <p className="text-sm text-slate-500 mb-2">Issued by CompTIA</p>
                        </div>
                    </div>
                </article>
          </div>
        </section>
        </div>
      </div>
  );
}

export default Career;