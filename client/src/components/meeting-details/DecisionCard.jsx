import React from "react";

const DecisionCard = ({ decision, index }) => {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
      <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-semibold">
        {index + 1}
      </div>
      <p className="text-gray-700 text-sm flex-1">{decision}</p>
    </div>
  );
};

export default DecisionCard;
