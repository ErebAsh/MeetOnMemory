import React from "react";
import OrganizationCard from "./OrganizationCard.jsx";

const OrganizationGrid = ({ organizations, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-gray-100 dark:bg-gray-800 rounded-2xl h-40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {organizations.map((org) => (
        <OrganizationCard key={org._id} organization={org} />
      ))}
    </div>
  );
};

export default OrganizationGrid;
