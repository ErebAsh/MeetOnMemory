import React, { createContext, useContext, useMemo } from "react";
import { hasPermission, getRolePermissions } from "../utils/rbacPermissions.js";

const RBACContext = createContext(null);

export const RBACProvider = ({ children, userRole }) => {
  const value = useMemo(() => {
    return {
      userRole,
      hasPermission: (resource, action) => hasPermission(userRole, resource, action),
      getPermissions: () => getRolePermissions(userRole),
    };
  }, [userRole]);

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
};

export const useRBAC = () => {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error("useRBAC must be used within a RBACProvider");
  }
  return context;
};

export default RBACContext;
