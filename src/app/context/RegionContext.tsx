import React, { createContext, useContext, useState, ReactNode } from "react";

export type Region = "NG" | "US" | "CN";

export interface RegionData {
  id: Region;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  defaultLocation: string;
}

export const regions: Record<Region, RegionData> = {
  NG: {
    id: "NG",
    name: "Nigeria",
    currencyCode: "NGN",
    currencySymbol: "₦",
    defaultLocation: "All Nigeria",
  },
  US: {
    id: "US",
    name: "United States",
    currencyCode: "USD",
    currencySymbol: "$",
    defaultLocation: "All USA",
  },
  CN: {
    id: "CN",
    name: "China",
    currencyCode: "CNY",
    currencySymbol: "¥",
    defaultLocation: "All China",
  },
};

interface RegionContextType {
  activeRegion: RegionData;
  setRegion: (regionId: Region) => void;
}

const RegionContext = createContext<RegionContextType | undefined>(undefined);

export function RegionProvider({ children }: { children: ReactNode }) {
  // Default to Nigeria for backward compatibility and origin
  const [activeRegion, setActiveRegion] = useState<RegionData>(regions.NG);

  const setRegion = (regionId: Region) => {
    setActiveRegion(regions[regionId]);
  };

  return (
    <RegionContext.Provider value={{ activeRegion, setRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const context = useContext(RegionContext);
  if (context === undefined) {
    throw new Error("useRegion must be used within a RegionProvider");
  }
  return context;
}
