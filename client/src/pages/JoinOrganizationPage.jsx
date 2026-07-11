// client/src/pages/JoinOrganizationPage.jsx
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppContent from "../context/AppContent";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import { organizationApi } from "../services";

const JoinOrganizationPage = () => {
  const { getUserData } = useContext(AppContent);
  const [orgList, setOrgList] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const { data } = await organizationApi.getAllOrganizations();
        if (data.success) setOrgList(data.organizations);
      } catch {
        toast.error("Failed to load organizations");
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  const handleJoin = async (orgId) => {
    try {
      const { data } = await organizationApi.joinOrganization({
        organizationId: orgId,
      });

      if (data.success) {
        toast.success("Joined organization successfully!");
        await getUserData();
        navigate("/dashboard");
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to join organization");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-950">
      <Navbar />
      <div className="flex-grow flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 border dark:border-gray-800 p-10 rounded-lg shadow-xl dark:shadow-none w-full max-w-lg text-center">
          <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white font-sans">Join an Organization</h1>
          {loading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading organizations...</p>
          ) : orgList.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No organizations available yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {orgList.map((org) => (
                <button
                  key={org._id}
                  onClick={() => handleJoin(org._id)}
                  className="p-4 bg-gray-800 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 transition-all cursor-pointer font-semibold"
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinOrganizationPage;
