import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { organizationApi } from "../services";
import { toast } from "react-toastify";
import {
  Building2,
  Users,
  Calendar,
  Globe,
  Shield,
  Tag,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";

const PublicOrganizationProfile = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await organizationApi.getPublicOrganizationBySlug(slug);
        
        if (data.success) {
          setOrganization(data.organization);
        } else {
          setError(data.message || "Failed to load organization");
        }
      } catch (err) {
        console.error("Error fetching organization:", err);
        if (err.response?.status === 404) {
          setError("Organization not found");
        } else {
          setError(err.response?.data?.message || "Failed to load organization");
        }
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchOrganization();
    }
  }, [slug]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleRequestAccess = () => {
    // Navigate to membership request flow (to be implemented in future issue)
    toast.info("Membership request flow coming soon");
    // For now, navigate to join organization page
    navigate("/join-organization");
  };

  // Loading Skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="animate-pulse">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-8" />
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
              <div className="flex items-start gap-6 mb-8">
                <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                <div className="flex-1">
                  <div className="h-8 w-96 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                  <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {error === "Organization not found" ? "Organization Not Found" : "Error"}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {error === "Organization not found"
                ? "The organization you're looking for doesn't exist or may have been removed."
                : error}
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty State
  if (!organization) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              No Organization Data
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Unable to load organization information.
            </p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    name,
    description,
    logo,
    memberCount,
    visibility,
    createdAt,
    website,
    socialLinks,
    tags,
  } = organization;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 h-48" />

      <div className="max-w-6xl mx-auto px-4 -mt-24 pb-12">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          {/* Organization Header */}
          <div className="p-8 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Logo */}
              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-4xl shadow-xl flex-shrink-0">
                {logo ? (
                  <img
                    src={logo}
                    alt={name}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  name?.charAt(0)?.toUpperCase() || "O"
                )}
              </div>

              {/* Organization Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {name}
                  </h1>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                      visibility === "public"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    {visibility?.charAt(0)?.toUpperCase() + visibility?.slice(1) || "Private"}
                  </span>
                </div>

                {description && (
                  <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                    {description}
                  </p>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>{memberCount || 0} members</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Created {formatDate(createdAt)}</span>
                  </div>
                  {website && (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      <span>Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Request Access Button */}
              <div className="flex-shrink-0">
                <button
                  onClick={handleRequestAccess}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-lg hover:shadow-xl"
                >
                  Request Access
                </button>
              </div>
            </div>
          </div>

          {/* Tags Section */}
          {tags && tags.length > 0 && (
            <div className="p-8 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Social Links Section */}
          {socialLinks && Object.keys(socialLinks).length > 0 && (
            <div className="p-8 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Social Links
              </h3>
              <div className="flex flex-wrap gap-4">
                {Object.entries(socialLinks).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <span className="capitalize">{platform}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Additional Info Section */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    Organization Details
                  </h4>
                </div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Visibility:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {visibility?.charAt(0)?.toUpperCase() + visibility?.slice(1) || "Private"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Member Count:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {memberCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatDate(createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    Membership
                  </h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Join this organization to collaborate with team members and access shared resources.
                </p>
                <button
                  onClick={handleRequestAccess}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                >
                  Request to Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicOrganizationProfile;
