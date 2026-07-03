import React from "react";
import { Brain, Search, BarChart3, Users } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Meeting Intelligence",
    description:
      "Automatically transcribe meetings, generate summaries, and capture action items.",
  },
  {
    icon: Search,
    title: "Semantic Search",
    description:
      "Quickly find discussions, decisions, and information from past meetings.",
  },
  {
    icon: BarChart3,
    title: "Smart Reports",
    description:
      "Generate AI-powered reports and insights to support better decisions.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Collaborate with your organization in one centralized knowledge hub.",
  },
];

const About = () => {
  return (
    <section
      id="about"
      className="pt-10 pb-24 bg-gradient-to-b from-white to-slate-50"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200">
            About Us
          </span>

          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mt-5">
            About{" "}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              MeetOnMemory
            </span>
          </h2>

          <p className="mt-6 text-lg text-gray-600 leading-relaxed">
            MeetOnMemory is an AI-powered knowledge management platform that
            transforms meetings into searchable, structured knowledge. Instead
            of losing valuable discussions, teams can instantly access
            summaries, action items, and key decisions whenever they need them.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <div
                key={index}
                
                className="bg-gradient-to-b from-white to-slate-50 border border-gray-200 rounded-2xl p-7 shadow-sm h-full transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white mx-auto mb-4 shadow-md shadow-blue-500/20">
                  <Icon className="w-6 h-6" />
                </div>

                <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                  {feature.title}
                </h3>

                <p className="text-gray-600 leading-relaxed text-center">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

       
      </div>
    </section>
  );
};

export default About;