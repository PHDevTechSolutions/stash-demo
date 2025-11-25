"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

// Levenshtein Distance (for fuzzy matching)
function levenshtein(a: string, b: string) {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
    }
  }

  return matrix[b.length][a.length];
}

// Clean and Normalize Company Name
function cleanCompanyName(name: string) {
  if (!name) return "";
  let n = name.toUpperCase();
  // Remove special characters: - _ .
  n = n.replace(/[-_.]/g, "");
  // Normalize spaces and trim
  n = n.replace(/\s+/g, " ").trim();
  // Remove trailing numbers like 1, 2, 001 etc.
  n = n.replace(/\d+$/g, "");
  // Final trim after removal
  n = n.trim();
  return n;
}

// List of disallowed abbreviations (case insensitive)
const disallowedAbbreviations = ["INC", "CORP", "LTD", "CO", "LLC",
  // add more as needed
];

// Check if company name contains disallowed abbreviation as a separate word
function containsDisallowedAbbreviation(name: string) {
  const words = name.toUpperCase().split(/\s+/);
  return words.some((word) => disallowedAbbreviations.includes(word));
}

const INDUSTRY_OPTIONS = [
  "ACCOMMODATION_AND_FOOD_SERVICE_ACTIVITIES",
  "ACTIVITIES_OF_EXTRATERRITORIAL_ORGANIZATIONS_AND_BODIES",
  "ACTIVITIES_OF_HOUSEHOLDS_AS_EMPLOYERS_UNDIFFERENTIATED_GOODS_AND_SERVICES_PRODUCING_ACTIVITIES_OF_HOUSEHOLDS_FOR_OWN_USE",
  "ADMINISTRATIVE_AND_SUPPORT_SERVICE_ACTIVITIES",
  "ADVERTISING_AND_MARKETING",
  "AGRICULTURE_FORESTRY_AND_FISHING",
  "ARTS_ENTERTAINMENT_AND_RECREATION",
  "AUTOMOTIVE",
  "B2C_BUSINESS_TO_CONSUMER",
  "B2G_BUSINESS_TO_GOVERNMENT",
  "CEMETERY_SERVICES",
  "COMMUNITY_MANAGEMENT",
  "CONSTRUCTION",
  "EDUCATION",
  "EDUCATION_AND_HUMAN_HEALTH_AND_SOCIAL_WORK_ACTIVITIES",
  "EDUCATION_AND_TRAINING",
  "ELECTRICITY_GAS_STEAM_AND_AIR_CONDITIONING_SUPPLY",
  "ENGINEERING",
  "FINANCIAL_AND_INSURANCE_ACTIVITIES",
  "FOOD_AND_BEVERAGE",
  "FORMATION_AND_COMMUNICATIO",
  "FUNERAL_SERVICES",
  "HEALTHCARE_AND_SERVICES",
  "HUMAN_HEALTH_AND_SOCIAL_WORK_ACTIVITIES",
  "INDIVIDUAL",
  "INDUSTRIAL_SAFETY",
  "INDUSTRY",
  "INFORMATION_AND_COMMUNICATION",
  "INSURANCE",
  "LOGISTICS_AND_TRANSPORTATION",
  "MANUFACTURING",
  "MINING_AND_QUARRYING",
  "OTHER_SERVICE_ACTIVITIES",
  "PAINTS_USED_IN_BUILDING",
  "PROFESSIONAL_SCIENTIFIC_AND_TECHNICAL_ACTIVITIES",
  "PUBLIC_ADMINISTRATION_AND_DEFENSE_COMPULSORY_SOCIAL_SECURITY",
  "REAL_ESTATE_ACTIVITIES",
  "RENEWABLE_ENERGY_HYDROPOWER",
  "SUPPORT_SERVICE_ACTIVITIES_OR_PROFESSIONAL_TECHNICAL_SERVICES",
  "TECHNICAL_ACTIVITIES",
  "TRADING",
  "TRANSPORTATION_AND_STORAGE",
  "WATER_SUPPLY_SEWERAGE_WASTE_MANAGEMENT_AND_REMEDIATION_ACTIVITIES",
  "WHOLESALE_AND_RETAIL_TRADE",
  "OTHER",
];

const TYPECLIENT_OPTIONS = [
  "TSA CLIENT",
];

const AREA_OPTIONS = [
  "Region I - Ilocos Region",
  "Region II - Cagayan Valley",
  "Region III - Central Luzon",
  "Region IV - CALABARZON",
  "Region V - Bicol Region",
  "Region VI - Western Visayas",
  "Region VII - Central Visayas",
  "Region VIII - Eastern Visayas",
  "Region IX - Zamboanga Peninsula",
  "Region X - Northern Mindanao",
  "Region XI - Davao Region",
  "Region XII - SOCCSKSARGEN",
  "NCR",
  "CAR",
  "BARMM",
  "Region XIII - Caraga",
  "MIMAROPA Region",
];

interface AccountFormData {
  id?: string;
  company_name: string;
  contact_person: string[];
  contact_number: string[];
  email_address: string[];
  address: string;
  region: string;
  status: string;
  delivery_address: string;
  type_client: string;
  industry: string;
  date_created?: string;
  company_group: string;
}

interface UserDetails {
  referenceid: string;
  tsm: string;
  manager: string;
}

interface AccountDialogProps {
  mode: "create" | "edit";
  userDetails: UserDetails;
  initialData?: Partial<AccountFormData>;
  onSaveAction: (data: AccountFormData & UserDetails) => void;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}

interface DuplicateCheckResponse {
  exists: boolean;
  companies: Array<{
    company_name: string;
    owner_referenceid: string;
  }>;
}

export function AccountDialog({
  mode,
  initialData,
  userDetails,
  onSaveAction,
  open,
  onOpenChangeAction,
}: AccountDialogProps) {
  const [formData, setFormData] = useState<AccountFormData>({
    company_name: "",
    contact_person: [""],
    contact_number: [""],
    email_address: [""],
    address: "",
    region: "",
    status: "Pending",
    delivery_address: "",
    type_client: "Choose Type Client",
    industry: "Choose Industry",
    company_group: "",
    ...initialData,
  });

  const [companyError, setCompanyError] = useState("");
  const [duplicateInfo, setDuplicateInfo] = useState<
    Array<{ company_name: string; owner_referenceid: string }>
  >([]);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const submitLock = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (mode === "edit") {
      setCompanyError("");
      setDuplicateInfo([]);
      setIsCheckingDuplicate(false);
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      const name = formData.company_name.trim();

      if (!name || name.length < 3) {
        setCompanyError("Company Name must be at least 3 characters.");
        setDuplicateInfo([]);
        return;
      }

      const cleaned = cleanCompanyName(name);

      if (["NONE", "N/A", "OTHER"].includes(cleaned)) {
        setCompanyError("Company Name Invalid.");
        setDuplicateInfo([]);
        return;
      }

      if (cleaned.startsWith("#")) {
        setCompanyError("Company names starting with # require supporting documents.");
        setDuplicateInfo([]);
        return;
      }

      // New check for disallowed abbreviations
      if (containsDisallowedAbbreviation(cleaned)) {
        setCompanyError(
          "Company name cannot contain abbreviations like INC, CORP, LTD, etc. Please use full words."
        );
        setDuplicateInfo([]);
        return;
      }

      setIsCheckingDuplicate(true);

      const controller = new AbortController();
      const signal = controller.signal;

      fetch(`/api/com-check-duplicate-account?company_name=${encodeURIComponent(cleaned)}`, { signal })
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to check duplicates");
          const data: DuplicateCheckResponse = await res.json();

          if (data.exists && data.companies.length > 0) {
            // Filter companies with fuzzy distance <= 2
            const similarCompanies = data.companies.filter((c) => {
              const dist = levenshtein(cleaned, cleanCompanyName(c.company_name));
              return dist <= 2;
            });

            if (similarCompanies.length > 0) {
              // Check if owned by others
              const otherOwner = similarCompanies.find(
                (c) => c.owner_referenceid !== userDetails.referenceid
              );

              if (otherOwner) {
                setCompanyError(
                  `Duplicate company owned by another TSA (RefID: ${otherOwner.owner_referenceid})`
                );
              } else {
                setCompanyError(
                  `Possible duplicate detected (owned by you): "${similarCompanies[0].company_name}"`
                );
              }
              setDuplicateInfo(similarCompanies);
            } else {
              setCompanyError("");
              setDuplicateInfo([]);
            }
          } else {
            setCompanyError("");
            setDuplicateInfo([]);
          }
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            console.error("Duplicate check failed:", err);
            setCompanyError("Failed to validate company name");
            setDuplicateInfo([]);
          }
        })
        .finally(() => setIsCheckingDuplicate(false));

      return () => controller.abort();
    }, 500); // debounce delay 500ms

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [formData.company_name, userDetails.referenceid, mode]);

  function handleSubmit() {
    if (submitLock.current) return;
    submitLock.current = true;

    if (companyError) {
      toast.error(companyError);
      submitLock.current = false;
      return;
    }

    const cleanData = {
      ...formData,
      company_name: cleanCompanyName(formData.company_name),
      contact_person: formData.contact_person.map((v) => v.trim()).filter(Boolean),
      contact_number: formData.contact_number.map((v) => v.trim()).filter(Boolean),
      email_address: formData.email_address.map((v) => v.trim()).filter(Boolean),
      referenceid: userDetails.referenceid,
      tsm: userDetails.tsm,
      manager: userDetails.manager,
      status: mode === "create" ? "Pending" : formData.status,
    };

    onSaveAction(cleanData);

    setTimeout(() => {
      submitLock.current = false;
    }, 1500);

    onOpenChangeAction(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      {mode === "create" && (
        <DialogTrigger asChild>
          <Button>Add Account</Button>
        </DialogTrigger>
      )}

      <DialogContent
        className="w-full max-w-[1280px] max-h-[85vh] overflow-y-auto"
        style={{ width: "40vw", maxWidth: "1600px", minWidth: "600px" }}
      >

        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create New Account" : "Edit Account"}</DialogTitle>
          <DialogDescription>Fill out the account details below.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="grid grid-cols-2 gap-6 mt-4"
        >
          {/* Company Name */}
          <div className="col-span-2">
            {mode === "edit" ? (
              <>
                <p className="uppercase font-semibold">{formData.company_name}</p>
                <input type="hidden" value={formData.company_name} />
              </>
            ) : (
              <Input
                required
                value={formData.company_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, company_name: e.target.value }))}
                placeholder="Company Name"
                className="uppercase"
              />
            )}
            {companyError && <p className="text-red-500 text-sm mt-1">{companyError}</p>}
            {isCheckingDuplicate && <p className="text-gray-500 text-xs">Checking duplicates...</p>}

            {duplicateInfo.length > 0 && (
              <div className="mt-2 text-sm">
                <p>Possible duplicates:</p>
                <ul className="list-disc ml-5">
                  {duplicateInfo.map((dup, idx) => (
                    <li key={idx}>
                      {dup.company_name} — Owner RefID: {dup.owner_referenceid}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Contact Person(s) */}
          <div>
            <label className="font-semibold mb-2 block">Contact Person(s)</label>
            {formData.contact_person.map((cp, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  required
                  value={cp}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => {
                      const copy = [...prev.contact_person];
                      copy[i] = val;
                      return { ...prev, contact_person: copy };
                    });
                  }}
                  placeholder="Contact Person"
                />
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (formData.contact_person.length > 1) {
                      setFormData((prev) => {
                        const copy = [...prev.contact_person];
                        copy.splice(i, 1);
                        return { ...prev, contact_person: copy };
                      });
                    }
                  }}
                  disabled={formData.contact_person.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, contact_person: [...prev.contact_person, ""] }))}
            >
              Add Contact Person
            </Button>
          </div>

          {/* Contact Number(s) */}
          <div>
            <label className="font-semibold mb-2 block">Contact Number(s)</label>
            {formData.contact_number.map((cn, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  required
                  value={cn}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => {
                      const copy = [...prev.contact_number];
                      copy[i] = val;
                      return { ...prev, contact_number: copy };
                    });
                  }}
                  placeholder="Contact Number"
                />
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (formData.contact_number.length > 1) {
                      setFormData((prev) => {
                        const copy = [...prev.contact_number];
                        copy.splice(i, 1);
                        return { ...prev, contact_number: copy };
                      });
                    }
                  }}
                  disabled={formData.contact_number.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, contact_number: [...prev.contact_number, ""] }))}
            >
              Add Contact Number
            </Button>
          </div>

          {/* Email Address(es) */}
          <div>
            <label className="font-semibold mb-2 block">Email Address(es)</label>
            {formData.email_address.map((em, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <Input
                  required
                  type="email"
                  value={em}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData((prev) => {
                      const copy = [...prev.email_address];
                      copy[i] = val;
                      return { ...prev, email_address: copy };
                    });
                  }}
                  placeholder="Email Address"
                />
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (formData.email_address.length > 1) {
                      setFormData((prev) => {
                        const copy = [...prev.email_address];
                        copy.splice(i, 1);
                        return { ...prev, email_address: copy };
                      });
                    }
                  }}
                  disabled={formData.email_address.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, email_address: [...prev.email_address, ""] }))}
            >
              Add Email Address
            </Button>
          </div>

          {/* Address */}
          <div>
            <Input
              required
              name="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Address"
            />
          </div>

          {/* Delivery Address */}
          <div>
            <Input
              required
              name="delivery_address"
              value={formData.delivery_address}
              onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
              placeholder="Delivery Address"
            />
          </div>

          {/* Region */}
          <div>
            <Select
              value={formData.type_client}
              onValueChange={(value) => setFormData({ ...formData, type_client: value })}
            >
              <SelectTrigger className="w-full">
                <span>{formData.region}</span>
              </SelectTrigger>
              <SelectContent>
                {AREA_OPTIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Client */}
          <div>
            <Select
              value={formData.type_client}
              onValueChange={(value) => setFormData({ ...formData, type_client: value })}
            >
              <SelectTrigger className="w-full">
                <span>{formData.type_client}</span>
              </SelectTrigger>
              <SelectContent>
                {TYPECLIENT_OPTIONS.map((type_client) => (
                  <SelectItem key={type_client} value={type_client}>
                    {type_client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Industry */}
          <div>
            <Select
              value={formData.industry}
              onValueChange={(value) => setFormData({ ...formData, industry: value })}
            >
              <SelectTrigger className="w-full">
                <span>{formData.industry}</span>
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Company Group */}
          <div>
            <Input
              required
              name="company_group"
              value={formData.company_group}
              onChange={(e) => setFormData({ ...formData, company_group: e.target.value })}
              placeholder="Group / Affiliate"
            />
          </div>

          {/* Status */}
          <div>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="w-full">
                <span>{formData.status}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit */}
          <div className="col-span-2 flex justify-end">
            <DialogFooter>
              <Button type="submit" disabled={!!companyError || isCheckingDuplicate}>
                {mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
