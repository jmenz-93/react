import React, { useState, Fragment } from 'react';
import { Transition} from '@headlessui/react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import MUImage from '../components/mu';
import UWMImage from '../components/uwm';
import AWSAIImage from '../components/aws_ai_badge';
import NMLogo from '../components/nm';
import { BriefcaseIcon, AcademicCapIcon, SparklesIcon } from '../components/icons';



const educationDetails = {
    uwm: {
        title: "University of Wisconsin-Milwaukee",
        degree: "Bachelor's in Information Science & Technology",
        info: [
            { label: "Graduated", value: "May 2017"},
            { label: "GPA", value: "3.8 / 4.0" },
            { label: "Honors", value: "Graduated Magna Cum Laude" },
            { label: "Relevant Coursework", value: "Relational Databases and Data Structures, Information Security, Web Development" },
        ],
    },
    mu: {
        title: "Marquette University",
        degree: "Master's in Computer and Information Science",
        imageUrl: "/mu.png",
        info: [
            { label: "GPA", value: "3.9 / 4.0" },
            { label: "Relevant Coursework", value: "Software Architecture, DevOps & CI/CD, Cloud Computing, Secure Software Development" },
        ],
    },
};

const workExperience = [
  {
    title: "Software Engineer III, Northwestern Mutual",
    dates: "2024 - Present",
    isCurrent: true,
    duties: [
      "Developed dbt Models in Snowflake",
      "",
      "...",
      "..."
    ],
    technologies: ["Snowflake", "dbt", "Python","Control-M", "AWS", "CI/CD", "Terraform"],
    imageUrl: "/nm.png"
  },
  {
    title: "Software Engineer II, Northwestern Mutual",
    dates: "2021 - 2024",
    isCurrent: false,
    duties: [
      "Developed Fact and Dimension Models in Databricks (PII Data).",
      "Worked with Business Users to Gather Requirements.",
      "Developed SSRS and Power BI Reports for the Wealth Business Department."
    ],
    technologies: ["Databricks", "SQL","Python", "Airflow", "CI/CD"],
    imageUrl: "/nm.png"
  },
  {
    title: "Software Engineer I, Northwestern Mutual",
    dates: "2019 - 2021",
    isCurrent: false,
    duties: [
      "Developed Datasets in Netezza that Sourced Data from DB2",
      "",
    ],
    technologies: ["SQL", "Netezza", "SSIS", "SQL Server"],
    imageUrl: "/nm.png"
  }
];


export function Career() {

  return (
    <>
      <div className="min-h-screen bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="sr-only">Career & Education</h1>

          {/* Summary of Myself */}
          <section className="mb-16">
          <article className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-600 leading-relaxed text-center text-lg">
                Add Details
            </p>
          </article>
        </section>

        {/* Work Experience */}
        <section className="mb-20">
          <div className="flex items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100/60">
                <BriefcaseIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="ml-4 text-sm font-bold uppercase tracking-widest text-slate-600">Work Experience</h2>
          </div>
          <div className="relative ml-6 border-l-2 border-slate-200">
            {workExperience.map((job, index) => (
              <div key={index} className="relative mb-10 ml-12">
                <span className={`absolute -left-[1.8rem] top-1 h-4 w-4 rounded-full ${job.isCurrent ? 'bg-blue-500' : 'bg-slate-300'} ring-8 ring-white`} />
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center mb-4">
                  <NMLogo imageUrl={job.imageUrl} linkUrl='https://www.northwesternmutual.com/' altText={`${job.title} logo`} />
                  <h3 className="text-xl font-semibold text-slate-800 mb-1 ml-3">{job.title}</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">{job.dates}</p>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-6">
                    {job.duties.map((duty, i) => <li key={i}>{duty}</li>)}
                  </ul>
                  <div className="mt-6 pt-4 border-t border-slate-200/80">
                      <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">Technologies Used</h4>
                      <div className="flex flex-wrap gap-2">
                        {job.technologies.map(tech => (
                          <span key={tech} className="px-3 py-1 text-xs font-medium text-teal-800 bg-teal-100/80 rounded-full">
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
              {Object.entries(educationDetails).map(([key, details]) => {
                const [isOpen, setIsOpen] = useState(false);
                const { refs, floatingStyles } = useFloating({
                  open: isOpen,
                  onOpenChange: setIsOpen,
                  placement: 'bottom',
                  whileElementsMounted: autoUpdate,
                  middleware: [offset(10), flip(), shift({ padding: 10 })],
                });

                return (
                  <div
                    key={key}
                    ref={refs.setReference}
                    onMouseEnter={() => setIsOpen(true)}
                    onMouseLeave={() => setIsOpen(false)}
                  >
                    <article
                      className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-all duration-300 h-full ${isOpen ? 'shadow-xl -translate-y-1' : 'hover:shadow-lg hover:-translate-y-1'}`}
                    >
                      <div className="flex items-center">
                        <div className="mr-5 flex-shrink-0">
                          {key === 'uwm' ? (
                            <UWMImage imageUrl="/uwm.png" linkUrl="https://uwm.edu/" altText="UWM" toolTip="Click Image for Website" />
                          ) : (
                            <MUImage imageUrl="/mu.png" linkUrl="https://www.marquette.edu/" altText="MU" toolTip="Click Image for Website" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-800">{details.title}</h3>
                          <p className="text-sm text-slate-500">{details.degree}</p>
                        </div>
                      </div>
                    </article>
                    <Transition
                      as={Fragment}
                      show={isOpen}
                      enter="transition ease-out duration-200"
                      enterFrom="opacity-0 scale-95"
                      enterTo="opacity-100 scale-100"
                      leave="transition ease-in duration-150"
                      leaveFrom="opacity-100 scale-100"
                      leaveTo="opacity-0 scale-95"
                    >
                      <div
                        ref={refs.setFloating}
                        style={floatingStyles}
                        className="z-20 w-screen max-w-sm"
                      >
                        <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5">
                          <div className="relative backdrop-blur-2xl p-7">
                                <dl className="space-y-4">
                                  {details.info.map((item) => (
                                    <div key={item.label}>
                                      <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.label}</dt>
                                      <dd className="mt-1 text-sm text-slate-800">{item.value}</dd>
                                    </div>
                                  ))}
                                </dl>
                          </div>
                        </div>
                      </div>
                    </Transition>
                  </div>
                );
              })}
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
          <article className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-all duration-300 h-full hover:shadow-lg hover:-translate-y-1">
                    <div className="flex items-center">
                        <div className="mr-5 flex-shrink-0">
                            <AWSAIImage imageUrl="/aws-ai-pract.png" altText="AWS AI Practitioner Badge" linkUrl="https://www.credly.com/badges/79ea3f7e-5b24-4d93-beee-982818b32699/public_url" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">AWS Certified AI Practitioner</h3>
                            <p className="text-sm text-slate-500">Issued by Amazon Web Services</p>
                        </div>
                    </div>
                </article>
          </div>
        </section>
        </div>
      </div>

      {/* Education Modal - REMOVED */}
    </>
  );
}

export default React.memo(Career);