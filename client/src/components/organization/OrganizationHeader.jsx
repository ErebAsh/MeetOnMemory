import React from "react";
import { Building2, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

const OrganizationHeader = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Organization Hub
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your organizations and discover new ones
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => navigate("/create-organization")}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-5 h-5" />
          <span>Create Organization</span>
        </button>

        <button
          onClick={() => navigate("/join-organization")}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold transition-all border border-gray-200 dark:border-gray-700"
        >
          <Search className="w-5 h-5" />
          <span>Browse</span>
        </button>
      </div>
    </div>
  );
};

export default OrganizationHeader;
