import React from 'react';
import { FaMicrophone, FaChartBar, FaFolderOpen, FaDatabase } from 'react-icons/fa';

const featuresData = [
  {
    id: 1,
    icon: <FaMicrophone />,
    title: "Meeting Recording & Upload",
    description: "Upload meeting recordings or transcripts for AI-powered processing and storage.",
    gradient: "from-blue-500 to-cyan-400"
  },
  {
    id: 2,
    icon: <FaChartBar />,
    title: "Reports & Analytics",
    description: "Generate insightful reports and visualize meeting activity and organizational trends.",
    gradient: "from-purple-500 to-pink-400"
  },
  {
    id: 3,
    icon: <FaFolderOpen />,
    title: "Policy Management",
    description: "Store, organize, version, and search organizational policies in one centralized location.",
    gradient: "from-green-500 to-emerald-400"
  },
  {
    id: 4,
    icon: <FaDatabase />,
    title: "Institutional Memory",
    description: "Preserve valuable organizational knowledge so information remains accessible even when team members change.",
    gradient: "from-orange-500 to-amber-400"
  }
];

const FeatureCard = ({ icon, title, description, gradient }) => {
  return (
    <div className="group bg-white rounded-2xl p-6 shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 hover:border-blue-200 relative overflow-hidden">
      {/* Icon with gradient background */}
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      
      <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
      
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-r from-blue-500/5 to-purple-500/5" />
    </div>
  );
};

const Features = () => {
  return (
    <section className="pt-32 pb-12 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Section Heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800">
            Powerful Features for{" "}
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Modern Organizations
            </span>
          </h2>
          <p className="text-gray-600 mt-4 max-w-2xl mx-auto text-sm md:text-base">
            Everything you need to capture, organize, and retrieve institutional knowledge.
          </p>
        </div>

        {/* Features Grid - Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuresData.map((feature) => (
            <FeatureCard key={feature.id} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;