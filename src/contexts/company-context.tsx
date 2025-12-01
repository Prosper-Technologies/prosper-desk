"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

interface CompanyContextType {
  currentCompanyId: string | null
  setCurrentCompanyId: (companyId: string | null) => void
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null)

  // Persist company selection in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("currentCompanyId")
    if (stored) {
      setCurrentCompanyId(stored)
    }
  }, [])

  const handleSetCurrentCompanyId = (companyId: string | null) => {
    setCurrentCompanyId(companyId)
    if (companyId) {
      localStorage.setItem("currentCompanyId", companyId)
    } else {
      localStorage.removeItem("currentCompanyId")
    }
  }

  return (
    <CompanyContext.Provider
      value={{
        currentCompanyId,
        setCurrentCompanyId: handleSetCurrentCompanyId,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider")
  }
  return context
}
