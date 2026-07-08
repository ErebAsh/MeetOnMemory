import { useState, useEffect, useRef } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const faqs = [
  {
    question: "Is MeetOnMemory free?",
    answer:
      "MeetOnMemory is currently under active development. During this phase, core features are available for testing. Pricing plans will be introduced as the platform matures.",
  },
  {
    question: "Which AI model is used?",
    answer:
      "MeetOnMemory leverages modern AI models such as Google Gemini for meeting summarization and knowledge extraction. Additional AI services may be integrated as the platform evolves.",
  },
  {
    question: "Can I upload meeting recordings?",
    answer:
      "Yes, you can upload meeting recordings, transcripts, and supporting documents. The platform processes them to generate summaries, extract key decisions, and build searchable organizational knowledge.",
  },
  {
    question: "How secure is my data?",
    answer:
      "Security is a priority. Authentication, protected APIs, and organization-based access controls help ensure your meeting data remains private and accessible only to authorized users.",
  },
  {
    question: "Can I search previous meetings?",
    answer:
      "Absolutely. MeetOnMemory uses AI-powered semantic search so you can ask natural language questions and quickly retrieve discussions, action items, and past decisions.",
  },
  {
    question: "What file formats are supported?",
    answer:
      "The platform is designed to support meeting recordings, transcripts, PDFs, and other commonly used meeting documents. Additional formats may be added over time.",
  },
  {
    question: "Can multiple team members collaborate?",
    answer:
      "Yes. Organizations can collaborate in shared workspaces where members can access meetings, documents, AI summaries, and organizational knowledge together.",
  },
  {
    question: "Can I generate meeting reports?",
    answer:
      "Yes. AI-generated reports include meeting summaries, key decisions, action items, analytics, and structured Minutes of Meeting (MoM) to improve productivity.",
  },
];

const FAQItem = ({ faq, index, isOpen, onClick }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stagger = `stagger-${Math.min((index % 6) + 1, 6)}`;

  return (
    <div
      ref={ref}
      className={`fade-in-up ${stagger} rounded-2xl border transition-all duration-300 ${
        isOpen
          ? "border-blue-200 shadow-md shadow-blue-500/10 bg-white"
          : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md"
      }`}
    >
      <button
        className="flex w-full items-center justify-between px-6 py-5 text-left focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${index}`}
        id={`faq-btn-${index}`}
      >
        <span className="text-base sm:text-lg font-semibold text-gray-900 pr-4">
          {faq.question}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 flex-shrink-0 text-blue-600 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={`faq-answer-${index}`}
        role="region"
        aria-labelledby={`faq-btn-${index}`}
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6 text-gray-600 leading-7 text-sm sm:text-base">
            {faq.answer}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(-1);
  const navigate = useNavigate();
  const headingRef = useRef(null);

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="faq"
      className="relative overflow-hidden py-24 px-4 sm:px-6 bg-linear-to-b from-white via-slate-50 to-white"
    >
      <div className="max-w-3xl mx-auto">
        {/* Heading */}
        <div ref={headingRef} className="fade-in-up text-center mb-14">
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-semibold tracking-wider uppercase text-blue-700">
            FAQ
          </span>

          <h2 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Frequently Asked Questions
          </h2>

          <p className="mt-4 text-gray-500 max-w-2xl mx-auto text-base leading-relaxed">
            Everything you need to know about MeetOnMemory, AI-powered meeting
            intelligence, collaboration, and knowledge management.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              faq={faq}
              index={index}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
            />
          ))}
        </div>

        {/* CTA below FAQ */}
        <div className="mt-14 text-center p-8 rounded-2xl bg-linear-to-br from-blue-50 to-violet-50 border border-blue-100">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Still have questions?
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            Try MeetOnMemory yourself — no credit card required.
          </p>
          <button
            id="faq-cta-btn"
            onClick={() => navigate("/login?mode=signup")}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-linear-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-100 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Get started with MeetOnMemory for free"
          >
            Get Started for Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
}
