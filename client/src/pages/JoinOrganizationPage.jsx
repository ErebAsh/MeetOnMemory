// client/src/pages/JoinOrganizationPage.jsx
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppContent from "../context/AppContent";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import { organizationApi } from "../services";
import { Building2, Search, ArrowRight, Users } from "lucide-react";

const JoinOrganizationPage = () => {
  const { getUserData, setUserData } = useContext(AppContent);
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
        const updatedUser = await getUserData();
        if (updatedUser) {
          setUserData(updatedUser);
          localStorage.setItem("userData", JSON.stringify(updatedUser));
        }
        navigate("/organizations");
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to join organization");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
              <Search className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Browse Organizations
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Discover and join organizations to collaborate with your team
            </p>
          </div>

          {/* Organization List */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-800 rounded-2xl h-40 animate-pulse"
                />
              ))}
            </div>
          ) : orgList.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Organizations Available
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                There are no organizations to join at the moment.
              </p>
              <button
                onClick={() => navigate("/create-organization")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all"
              >
                Create an Organization
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {orgList.map((org) => (
                <div
                  key={org._id}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {org.name?.charAt(0)?.toUpperCase() || "O"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                        {org.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>Join to view members</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoin(org._id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all hover:shadow-lg"
                  >
                    Join Organization
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinOrganizationPage;
