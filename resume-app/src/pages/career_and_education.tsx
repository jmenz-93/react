import React, { useState, Fragment } from 'react';
import { Transition } from '@headlessui/react';
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
            { label: "GPA", value: "3.8 / 4.0" }
        ],
    },
    mu: {
        title: "Marquette University",
        degree: "Master's in Computer and Information Science",
        imageUrl: "/mu.png",
        info: [
            { label: "Anticipated Graduation", value: "December 2026"},
            { label: "GPA", value: "3.8 / 4.0" },
            { label: "Relevant Coursework", value: "Software Architecture, DevOps & CI/CD, Cloud Computing, Secure Software Development" },
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
      <div className="min-h-screen bg-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="sr-only">Career & Education</h1>

          {/* Summary of Myself */}
          <section className="mb-16">
          <article className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-slate-600 leading-relaxed text-center text-lg max-w-3xl mx-auto">
                A highly motivated data professional with 7 years of experience building and maintaining robust data solutions. Passionate about leveraging modern technologies to tackle complex challenges and continuously expanding my skill set.
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
            {workExperience.map(job => (
              <div key={job.id} className="relative mb-12 ml-12">
                <span className={`absolute -left-[1.8rem] top-6 h-4 w-4 rounded-full border-2 border-white ${job.isCurrent ? 'bg-blue-600 ring-4 ring-blue-50' : 'bg-slate-300 ring-4 ring-slate-50'}`} />
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
                  <div className="flex items-center mb-4">
                    <NMLogo imageUrl={job.imageUrl} linkUrl='https://www.northwesternmutual.com/' altText={`${job.title} logo`} />
                    <div className="ml-4">
                      <h3 className="text-lg font-bold text-slate-800">{job.title}</h3>
                      <p className="text-sm font-medium text-slate-500">{job.dates}</p>
                    </div>
                  </div>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed marker:text-slate-400">
                    {job.duties.map((duty, i) => <li key={i}>{duty}</li>)}
                  </ul>
                  <div className="mt-6 pt-4 border-t border-slate-100">
                      <div className="flex flex-wrap gap-2">
                        {job.technologies.map(tech => (
                          <span key={tech} className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md border border-slate-200">
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
                <EducationCard
                  key={key}
                  eduKey={key}
                  title={details.title}
                  degree={details.degree}
                  info={details.info}
                />
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
          <article className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-all duration-300 h-full hover:shadow-lg hover:-translate-y-1 group">
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
          </div>
        </section>
        </div>
      </div>
  );
}

interface EducationCardProps {
  eduKey: string;
  title: string;
  degree: string;
  info: { label: string; value: string }[];
}

const EducationCard: React.FC<EducationCardProps> = ({ eduKey, title, degree, info }) => {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom',
    whileElementsMounted: autoUpdate,
    middleware: [offset(10), flip(), shift({ padding: 10 })],
  });

  return (
    <div
      ref={refs.setReference}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="relative"
    >
      <article
        className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm cursor-pointer transition-all duration-300 h-full ${open ? 'shadow-xl -translate-y-1' : 'hover:shadow-lg hover:-translate-y-1'}`}
      >
        <div className="flex items-center">
          <div className="mr-5 flex-shrink-0">
            {eduKey === 'uwm' ? (
              <UWMImage imageUrl="/uwm.png" linkUrl="https://uwm.edu/" altText="UWM" toolTip="Click Image for Website" />
            ) : (
              <MUImage imageUrl="/mu.png" linkUrl="https://www.marquette.edu/" altText="MU" toolTip="Click Image for Website" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500">{degree}</p>
          </div>
        </div>
      </article>
      <Transition
        as={Fragment}
        show={open}
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
                {info.map(item => (
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
};

export default Career;