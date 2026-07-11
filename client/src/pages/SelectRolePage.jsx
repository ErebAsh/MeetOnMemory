// client/src/pages/SelectRolePage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

const SelectRolePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-950">
      <Navbar />
      <div className="grow flex flex-col items-center justify-center">
        <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 p-10 rounded-lg shadow-xl dark:shadow-none text-center w-[90%] max-w-lg">
          <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">How are you joining?</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Select a role to get started.</p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={() => navigate("/create-organization")}
              className="w-64 sm:w-48 p-6 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-all text-xl font-semibold cursor-pointer"
            >
              Join as Admin
            </button>

            <button
              onClick={() => navigate("/join-organization")}
              className="w-64 sm:w-48 p-6 bg-gray-700 dark:bg-gray-800 text-white rounded-lg shadow-lg hover:bg-gray-800 dark:hover:bg-gray-750 transition-all text-xl font-semibold cursor-pointer"
            >
              Join as Member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectRolePage;
