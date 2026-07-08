import React from "react";

const SummarySection = ({ title, icon, children, className = "" }) => {
  if (!children || (Array.isArray(children) && children.length === 0)) {
    return null;
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4 ${className}`}
    >
      <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="text-gray-700 text-sm">{children}</div>
    </div>
  );
};

export default SummarySection;
