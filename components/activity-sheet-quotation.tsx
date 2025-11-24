"use client";

import React, { useState } from "react";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Props {
  step: number;
  setStep: (step: number) => void;

  source: string;
  setSource: (v: string) => void;

  productCat: string;
  setProductCat: (v: string) => void;

  projectType: string;
  setProjectType: (v: string) => void;

  projectName: string;
  setProjectName: (v: string) => void;

  quotationNumber: string;
  setQuotationNumber: (v: string) => void;

  quotationAmount: string;
  setQuotationAmount: (v: string) => void;

  callType: string;
  setCallType: (v: string) => void;

  followUpDate: string;
  setFollowUpDate: (v: string) => void;

  remarks: string;
  setRemarks: (v: string) => void;

  status: string;
  setStatus: (v: string) => void;

  handleBack: () => void;
  handleNext: () => void;
}

const Quotation_SOURCES = [
  {
    label: "Existing Client",
    description: "Clients with active accounts or previous transactions.",
  },
  {
    label: "CSR Inquiry",
    description: "Customer Service Representative inquiries.",
  },
  {
    label: "Government",
    description: "Calls coming from government agencies.",
  },
  {
    label: "Philgeps Website",
    description: "Inquiries from Philgeps online platform.",
  },
  {
    label: "Philgeps",
    description: "Other Philgeps related contacts.",
  },
  {
    label: "Distributor",
    description: "Calls from product distributors or resellers.",
  },
  {
    label: "Modern Trade",
    description: "Contacts from retail or modern trade partners.",
  },
  {
    label: "Facebook Marketplace",
    description: "Leads or inquiries from Facebook Marketplace.",
  },
  {
    label: "Walk-in Showroom",
    description: "Visitors physically coming to showroom.",
  },
];

export function QuotationSheet(props: Props) {
  const {
    step,
    setStep,
    source,
    setSource,
    productCat,
    setProductCat,
    projectType,
    setProjectType,
    projectName,
    setProjectName,
    quotationNumber,
    setQuotationNumber,
    quotationAmount,
    setQuotationAmount,
    callType,
    setCallType,
    followUpDate,
    setFollowUpDate,
    remarks,
    setRemarks,
    status,
    setStatus,
    handleBack,
    handleNext,
  } = props;

  const [quotationNumberError, setQuotationNumberError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; title: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Validation states for steps
  const isStep2Valid = source.trim() !== "";

  const isStep3Valid = productCat.trim() !== "" && projectType.trim() !== "";

  const isStep4Valid =
    quotationNumber.trim().length >= 6 &&
    quotationAmount.trim() !== "" &&
    callType.trim() !== "";

  const isStep5Valid = status.trim() !== "";

  // Handle next on step 4 with validation + error messages
  const handleNextStep4 = () => {
    if (quotationNumber.trim().length < 6) {
      setQuotationNumberError("Quotation Number must be more than 5 characters.");
      return;
    }
    if (quotationAmount.trim() === "") {
      toast.error("Please enter Quotation Amount.");
      return;
    }
    if (callType.trim() === "") {
      toast.error("Please select Call Type.");
      return;
    }
    setQuotationNumberError("");
    handleNext();
  };

  return (
    <>
      {/* STEP 2 — SOURCE */}
      {step === 2 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel>Source</FieldLabel>
              <RadioGroup
                defaultValue={source}
                onValueChange={(value) => setSource(value)}
              >
                {Quotation_SOURCES.map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button onClick={handleBack}>Back</Button>
            <Button onClick={handleNext} disabled={!isStep2Valid}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — PRODUCT DETAILS */}
      {step === 3 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel>Product Name</FieldLabel>
              <Input
                type="text"
                value={productCat}
                onChange={(e) => setProductCat(e.target.value)}
              />

              <FieldLabel className="mt-3">Project Type</FieldLabel>
              <RadioGroup value={projectType} onValueChange={setProjectType}>
                {[
                  {
                    label: "B2B",
                    description: "Business to Business transactions.",
                  },
                  {
                    label: "B2C",
                    description: "Business to Consumer transactions.",
                  },
                  { label: "B2G", description: "Business to Government contracts." },
                  { label: "Gentrade", description: "General trade activities." },
                  {
                    label: "Modern Trade",
                    description: "Retail and modern trade partners.",
                  },
                ].map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>

              <FieldLabel className="mt-3">Project Name (Optional)</FieldLabel>
              <Input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={!isStep3Valid}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — QUOTATION DETAILS */}
      {step === 4 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel>Quotation Number</FieldLabel>
              <Input
                type="text"
                value={quotationNumber}
                onChange={(e) => {
                  setQuotationNumber(e.target.value);
                  if (quotationNumberError) setQuotationNumberError("");
                }}
                placeholder="Enter quotation number"
              />
              <FieldDescription className="text-sm text-muted-foreground">
                Quotation Number Source from TSM
              </FieldDescription>
              {quotationNumberError && (
                <p className="mt-1 text-sm text-red-600">{quotationNumberError}</p>
              )}

              <FieldLabel className="mt-3">Quotation Amount</FieldLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={quotationAmount}
                onChange={(e) => setQuotationAmount(e.target.value)}
                placeholder="Enter quotation amount"
              />

              <FieldLabel className="mt-3">Type</FieldLabel>
              <RadioGroup value={callType} onValueChange={setCallType}>
                {[
                  {
                    label: "Sent Quotation Standard",
                    description: "Standard quotation sent to client.",
                  },
                  {
                    label: "Sent Quotation with Special Price",
                    description: "Quotation with a special pricing offer.",
                  },
                  {
                    label: "Sent Quotation with SPF",
                    description: "Quotation including SPF (Special Pricing Framework).",
                  },
                  {
                    label: "With SPFS",
                    description: "Quotation with SPFS details included.",
                  },
                ].map(({ label, description }) => (
                  <FieldLabel key={label}>
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldTitle>{label}</FieldTitle>
                        <FieldDescription>{description}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={label} />
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>

              <FieldLabel className="mt-3">Follow Up Date</FieldLabel>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleNextStep4} disabled={!isStep4Valid}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5 — REMARKS & STATUS */}
      {step === 5 && (
        <div>
          <FieldGroup>
            <FieldSet>
              <FieldLabel>Remarks</FieldLabel>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks"
              />
            </FieldSet>
          </FieldGroup>

          <FieldGroup>
            <FieldSet>
              <FieldLabel className="mt-3">Status</FieldLabel>
              <RadioGroup value={status} onValueChange={setStatus}>
                <FieldLabel>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Quote Done</FieldTitle>
                      <FieldDescription>
                        The quotation process is complete and finalized.
                      </FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="Quote-Done" />
                  </Field>
                </FieldLabel>
              </RadioGroup>
            </FieldSet>
          </FieldGroup>

          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
