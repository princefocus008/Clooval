/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useLocation } from "react-router-dom";
import { useCreateRequest } from "../../hooks/queries";
import { useToastStore } from "../../lib/store";
import { RequestCategory, PriorityLevel } from "../../types";
import {
  Smartphone,
  Laptop,
  Shirt,
  Hammer,
  Gem,
  HelpCircle,
  Camera,
  X,
  Phone,
  ArrowLeft,
  Loader2,
} from "lucide-react";

// Register validation schema with Zod
const requestSchema = z.object({
  category: z.enum(["phone", "laptop", "clothing", "shoe", "accessories", "other"], "Please select a service category"),
  description: z
    .string()
    .min(20, "Please describe the problem in more specify (minimum 20 characters)"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  studentPhone: z.string().min(5, "Contact phone number is required"),
  additionalNotes: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

const CAT_OPTIONS = [
  { value: "phone" as const, label: "Phone Repair", icon: Smartphone },
  { value: "laptop" as const, label: "Laptop Repair", icon: Laptop },
  { value: "clothing" as const, label: "Clothing Alteration", icon: Shirt },
  { value: "shoe" as const, label: "Shoe Repair", icon: Hammer },
  { value: "accessories" as const, label: "Accessories", icon: Gem },
  { value: "other" as const, label: "Other Repair", icon: HelpCircle },
];

const PRIORITY_OPTIONS = [
  { value: "low" as const, label: "Low", color: "#999999" },
  { value: "normal" as const, label: "Normal", color: "#555555" },
  { value: "high" as const, label: "High", color: "#111111" },
  { value: "urgent" as const, label: "Urgent", color: "#111111" },
];

export default function NewRequestForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const paramCategory = queryParams.get("category");
  const allowedCategories = ["phone", "laptop", "clothing", "shoe", "accessories", "other"];
  const guidedData = location.state?.guidedData as
    | {
        category: RequestCategory;
        brand: string | null;
        model: string | null;
        issues: string[];
        accessoryType: string | null;
      }
    | undefined;
  const initialCategory = (paramCategory && allowedCategories.includes(paramCategory))
    ? (paramCategory as RequestCategory)
    : undefined;
  const guidedCategory = guidedData?.category ?? initialCategory;

  const paramDescription = queryParams.get("description") || queryParams.get("desc") || "";
  const paramPriority = queryParams.get("priority") || "normal";
  const allowedPriorities = ["low", "normal", "high", "urgent"];
  const initialPriority = (paramPriority && allowedPriorities.includes(paramPriority))
    ? (paramPriority as PriorityLevel)
    : "normal";

  const paramPhone = queryParams.get("phone") || "";
  const paramNotes = queryParams.get("notes") || queryParams.get("additionalNotes") || "";

  const { addToast } = useToastStore();
  const createMutation = useCreateRequest();

  const [photos, setPhotos] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Hook Form setup
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      category: guidedCategory,
      description: paramDescription,
      priority: initialPriority,
      studentPhone: paramPhone,
      additionalNotes: paramNotes,
    },
  });

  const descriptionValue = watch("description");

  // Handle Photo input (converts to base64 for quick persistence in memory DB)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const files = e.target.files;
    if (!files) return;

    if (photos.length + files.length > 5) {
      setFileError("You can upload a maximum of 5 photos.");
      return;
    }

    Array.from(files).forEach((file: File) => {
      // Format validation
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setFileError("Format not supported. Please upload JPEG, PNG, or WEBP only.");
        return;
      }
      // Weight limit (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setFileError("File too large. Max allowed size is 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (indexToRemove: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const onSubmit = (data: RequestFormData) => {
    createMutation.mutate(
      {
        ...data,
        photos,
      },
      {
        onSuccess: (newReq) => {
          navigate(`/app/requests/${newReq.id}`);
        },
      }
    );
  };

  const summarySelection = guidedData
    ? [
        guidedData.brand || (CAT_OPTIONS.find((option) => option.value === guidedData.category)?.label ?? ''),
        guidedData.model,
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  const summaryIssues = guidedData?.issues?.length ? guidedData.issues.join(', ') : '';
  const summaryText = guidedData
    ? `${summarySelection || CAT_OPTIONS.find((option) => option.value === guidedData.category)?.label}: ${summaryIssues}`
    : '';

  return (
    <div className="space-y-6 animate-slide-up">
      {/* HEADER WITH BACK REVIEWS */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="p-1.5 rounded-lg border border-[#E5E5E3] hover:bg-[#F7F7F5] text-[#555555] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-semibold tracking-tight text-[#111111]">New Request</h2>
      </div>

      {guidedData ? (
        <div className="rounded-lg border border-[#E5E5E3] bg-[#F1F2E9] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#555555]">YOUR SELECTION</p>
            <p className="text-sm font-semibold text-[#111111] mt-1">{summaryText}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-[13px] font-semibold text-[#111111] underline underline-offset-2 decoration-[#111111]"
          >
            Edit
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-12 text-left">
        {guidedData ? <input type="hidden" value={guidedData.category} {...register('category')} /> : null}
        {/* SECTION 1: Category Selection */}
        {!guidedData ? (
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#555555]">
                Section 1  What do you need fixed?
              </h3>
              <p className="text-xs text-[#999999] mt-0.5">Please select the service category fitting your repair.</p>
            </div>

            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CAT_OPTIONS.map((item) => {
                    const Selected = field.value === item.value;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => field.onChange(item.value)}
                        className={`h-20 rounded-lg flex flex-col items-center justify-center p-3 text-center transition cursor-pointer ${
                          Selected
                            ? "border-2 border-[#111111] bg-[#F1F2E9] text-[#111111]"
                            : "border border-[#E5E5E3] bg-transparent text-[#555555] hover:border-[#111111] hover:text-[#111111]"
                        }`}
                      >
                        <Icon className="w-5 h-5 mb-1 shrink-0" />
                        <span className="text-xs font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.category && (
              <p className="text-xs text-[#E74C3C] font-semibold mt-1">{errors.category.message}</p>
            )}
          </section>
        ) : null}

        {/* SECTION 2: Description */}
        <section className="space-y-3">
          <div className="flex justify-between items-baseline">
            <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#555555]">
              Section 2  Describe the issue
            </h3>
            <span className="text-[11px] text-[#999999]">Required</span>
          </div>
          <div className="relative">
            <textarea
              id="desc-textarea"
              placeholder="e.g. My screen is completely cracked at the bottom left-hand corner from falling off a nightstand. The display is fine but touch handles are totally dead there."
              rows={4}
              className={`w-full p-3 bg-transparent border rounded-lg text-sm transition focus:border-2 focus:border-[#111111] focus:outline-none ${
                errors.description ? "border-2 border-[#E74C3C]" : "border-[#E5E5E3]"
              }`}
              {...register("description")}
            />
            <div className="absolute right-3 bottom-3 text-xs text-[#999999]">
              {descriptionValue ? descriptionValue.length : 0} characters
            </div>
          </div>
          {errors.description && (
            <p className="text-xs text-[#E74C3C] font-semibold mt-1">{errors.description.message}</p>
          )}
        </section>

        {/* SECTION 3: Image uploads */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#555555]">
            Section 3  Upload photos (optional but recommended)
          </h3>
          <div className="relative border-2 border-dashed border-[#E5E5E3] rounded-lg hover:border-[#111111] transition-all bg-transparent p-6 cursor-pointer flex flex-col items-center justify-center min-h-[120px]">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Upload item photos"
            />
            <Camera className="w-6 h-6 text-[#999999] mb-1.5 shrink-0" />
            <p className="text-sm font-medium text-[#111111]">Tap or drag to add photos</p>
            <p className="text-xs text-[#999999]">Up to 5 photos. Max 5MB each.</p>
          </div>
          {fileError && <p className="text-xs text-[#E74C3C] font-semibold">{fileError}</p>}

          {/* Photo Previews */}
          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-2">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-[#E5E5E3]">
                  <img src={photo} alt="Item upload preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-black text-white rounded-full transition"
                    aria-label="Remove photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 4: Priority selector */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#555555]">
            Section 4  Priority level
          </h3>

          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PRIORITY_OPTIONS.map((item) => {
                  const Selected = field.value === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => field.onChange(item.value)}
                      style={{
                        borderColor: Selected ? item.color : "#E5E5E3",
                        borderWidth: Selected ? "2px" : "1px",
                        backgroundColor: Selected ? `${item.color}0D` : "#FFFFFF",
                      }}
                      className="px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 border text-sm font-semibold transition cursor-pointer text-[#111111] hover:bg-[#F7F7F5]"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </section>

        {/* SECTION 5: Phone + Additional Notes */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.05em] text-[#555555] border-b border-[#E5E5E3] pb-2">
            Section 5  Contact Details & Additional notes
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] mb-1.5">
                Your Contact Phone Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. +230 5111 2233"
                  className={`w-full h-10 pl-9 pr-3 bg-white border rounded-lg text-sm transition focus:border-2 focus:border-[#111111] focus:outline-none ${
                    errors.studentPhone ? "border-2 border-[#E74C3C]" : "border-[#E5E5E3]"
                  }`}
                  {...register("studentPhone")}
                />
                <Phone className="w-4 h-4 text-[#999999] absolute left-3 top-1/2 -translate-y-1/2 shrink-0" />
              </div>
              {errors.studentPhone && (
                <p className="text-xs text-[#E74C3C] font-semibold mt-1">{errors.studentPhone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-[#555555] mb-1.5">
                Any other details for our concierge team? (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. I need this back before Friday afternoon"
                className="w-full h-10 px-3 bg-white border border-[#E5E5E3] rounded-lg text-sm transition focus:border-2 focus:border-[#111111] focus:outline-none"
                {...register("additionalNotes")}
              />
            </div>
          </div>
        </section>

        {/* SUBMIT ROW */}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full h-11 bg-[#111111] hover:bg-[#333333] text-white font-medium rounded-lg text-sm transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          id="submit-request-btn"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Submitting Request...</span>
            </>
          ) : (
            <span>Submit Request</span>
          )}
        </button>
      </form>
    </div>
  );
}
