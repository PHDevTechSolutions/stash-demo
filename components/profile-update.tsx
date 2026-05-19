"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { UserProvider } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import Image from "next/image";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { type DateRange } from "react-day-picker";
import { Camera, Eye, EyeOff, RefreshCw } from "lucide-react";

interface UserDetails {
    id: string;
    Firstname: string;
    Lastname: string;
    Email: string;
    Role: string;
    Department: string;
    Status: string;
    ContactNumber: string;
    profilePicture: string;
    Password?: string;
    ContactPassword?: string;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
    "w-full px-2.5 py-1.5 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors disabled:opacity-40";
const inputStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.7)",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="text-[9px] uppercase tracking-[0.15em] mb-1.5 block" style={{ color: "rgba(255,255,255,0.3)" }}>
            {children}
        </label>
    );
}

function SectionHeader({ dot, children }: { dot: string; children: React.ReactNode }) {
    return (
        <div
            className="flex items-center gap-2 px-4 py-2.5 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(0,0,0,0.3)" }}
        >
            <span className="inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot, boxShadow: `0 0 5px ${dot}` }} />
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: dot }}>{children}</span>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfileClient() {
    const searchParams = useSearchParams();
    const userId = searchParams?.get("id") ?? "";

    const [userDetails,   setUserDetails]   = useState<UserDetails | null>(null);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState<string | null>(null);
    const [saving,        setSaving]        = useState(false);
    const [uploading,     setUploading]     = useState(false);
    const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong" | "">("");
    const [showPassword,        setShowPassword]        = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] = useState<DateRange | undefined>(undefined);

    useEffect(() => {
        if (!userId) { setError("User ID missing in URL"); setLoading(false); return; }
        async function fetchUser() {
            try {
                const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
                if (!res.ok) throw new Error("Failed to fetch user");
                const data = await res.json();
                setUserDetails({
                    id: data._id || "",
                    Firstname: data.Firstname || "", Lastname: data.Lastname || "",
                    Email: data.Email || "", Role: data.Role || "",
                    Department: data.Department || "", Status: data.Status || "",
                    ContactNumber: data.ContactNumber || "",
                    profilePicture: data.profilePicture || "",
                    Password: "", ContactPassword: "",
                });
            } catch (e) { console.error(e); setError("Error loading user data"); }
            finally { setLoading(false); }
        }
        fetchUser();
    }, [userId]);

    const calcStrength = (p: string): "weak" | "medium" | "strong" | "" => {
        if (!p) return "";
        if (p.length < 4) return "weak";
        if (/^(?=.*[a-z])(?=.*\d).{6,}$/.test(p)) return "medium";
        if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(p)) return "strong";
        return "weak";
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!userDetails) return;
        const { name, value } = e.target;
        setUserDetails({ ...userDetails, [name]: value });
        if (name === "Password") setPasswordStrength(calcStrength(value));
    };

    const handleGeneratePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
        const pass = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        setUserDetails((prev) => prev ? { ...prev, Password: pass, ContactPassword: pass } : prev);
        setPasswordStrength(calcStrength(pass));
    };

    const handleImageUpload = async (file: File) => {
        setUploading(true);
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", "Xchire");
        try {
            const res  = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload", { method: "POST", body: data });
            const json = await res.json();
            if (json.secure_url) {
                setUserDetails((prev) => prev ? { ...prev, profilePicture: json.secure_url } : prev);
                toast.success("Image uploaded successfully.");
            } else { toast.error("Failed to upload image."); }
        } catch { toast.error("Error uploading image."); }
        finally { setUploading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userDetails) return;
        if (userDetails.Password && userDetails.Password.length > 10) { toast.error("Password must be at most 10 characters."); return; }
        if (userDetails.Password !== userDetails.ContactPassword) { toast.error("Passwords do not match."); return; }
        setSaving(true);
        try {
            const { Password, ContactPassword, id, ...rest } = userDetails;
            const payload = { ...rest, id, ...(Password ? { Password } : {}), profilePicture: userDetails.profilePicture };
            const res = await fetch("/api/profile-update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed to update profile");
            toast.success("Profile updated successfully.");
            setUserDetails((prev) => prev ? { ...prev, Password: "", ContactPassword: "" } : prev);
            setPasswordStrength("");
        } catch (err) { console.error(err); toast.error("Error updating profile."); }
        finally { setSaving(false); }
    };

    const strengthColor = passwordStrength === "strong" ? "#34d399" : passwordStrength === "medium" ? "#fbbf24" : "#f87171";

    if (loading) return (
        <div className="fixed inset-0 flex items-center justify-center font-mono" style={{ backgroundColor: "#080c10" }}>
            <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                <div className="w-3.5 h-3.5 border-t border-current rounded-full animate-spin" />
                <span className="text-[9px] uppercase tracking-widest">LOADING...</span>
            </div>
        </div>
    );
    if (error) return (
        <div className="fixed inset-0 flex items-center justify-center font-mono" style={{ backgroundColor: "#080c10" }}>
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "#f87171" }}>{error}</span>
        </div>
    );
    if (!userDetails) return null;

    return (
        <UserProvider>
            <FormatProvider>
                <SidebarProvider>
                    <SidebarLeft />
                    <SidebarInset className="overflow-hidden" style={{ backgroundColor: "#080c10" }}>
                        {/* Dot grid */}
                        <div
                            className="fixed inset-0 pointer-events-none"
                            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px", zIndex: 0 }}
                        />

                        <header
                            className="sticky top-0 flex h-14 shrink-0 items-center gap-2 border-b z-10 font-mono"
                            style={{ backgroundColor: "rgba(13,17,23,0.95)", borderColor: "rgba(255,255,255,0.07)" }}
                        >
                            <div className="flex flex-1 items-center gap-2 px-3">
                                <SidebarTrigger />
                                <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                                <Breadcrumb>
                                    <BreadcrumbList>
                                        <BreadcrumbItem>
                                            <BreadcrumbPage className="text-[10px] uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                                                Profile
                                            </BreadcrumbPage>
                                        </BreadcrumbItem>
                                    </BreadcrumbList>
                                </Breadcrumb>
                            </div>
                        </header>

                        <main className="relative z-10 flex flex-col gap-4 p-4 overflow-auto font-mono" style={{ minHeight: "calc(100vh - 3.5rem)" }}>
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-4xl w-full mx-auto">

                                {/* Top bar */}
                                <div
                                    className="flex items-center justify-between px-4 py-2.5 border"
                                    style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.02)" }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#fb923c", boxShadow: "0 0 5px #fb923c" }} />
                                        <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>PROFILE SETTINGS</span>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={saving || uploading}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 disabled:opacity-50"
                                        style={{ backgroundColor: "#fb923c", color: "#000", borderColor: "transparent" }}
                                    >
                                        {saving ? "SAVING..." : uploading ? "UPLOADING..." : "SAVE CHANGES →"}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                    {/* ── Avatar panel ── */}
                                    <div className="border flex flex-col" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>
                                        <SectionHeader dot="#fb923c">AVATAR</SectionHeader>
                                        <div className="flex flex-col items-center gap-4 p-5">
                                            {/* Avatar preview */}
                                            <div
                                                className="relative w-full aspect-square border overflow-hidden"
                                                style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
                                            >
                                                {userDetails.profilePicture ? (
                                                    <Image src={userDetails.profilePicture} alt="Profile" fill className="object-cover" />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full">
                                                        <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>NO PHOTO</span>
                                                    </div>
                                                )}
                                                {uploading && (
                                                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
                                                        <div className="w-5 h-5 border-t border-[#fb923c] rounded-full animate-spin" />
                                                    </div>
                                                )}
                                            </div>
                                            <input type="file" id="profilePicture" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} disabled={uploading} className="hidden" />
                                            <button
                                                type="button"
                                                onClick={() => document.getElementById("profilePicture")?.click()}
                                                disabled={uploading}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 disabled:opacity-50 w-full justify-center"
                                                style={{ color: "#fb923c", borderColor: "rgba(251,146,60,0.3)", backgroundColor: "rgba(251,146,60,0.06)" }}
                                            >
                                                <Camera className="h-3 w-3" />
                                                {uploading ? "UPLOADING..." : "CHANGE PHOTO"}
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Info panels ── */}
                                    <div className="md:col-span-2 flex flex-col gap-4">

                                        {/* Name */}
                                        <div className="border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>
                                            <SectionHeader dot="#38bdf8">NAME</SectionHeader>
                                            <div className="grid grid-cols-2 gap-4 p-4">
                                                <div className="flex flex-col">
                                                    <FieldLabel>First Name</FieldLabel>
                                                    <input id="Firstname" name="Firstname" type="text" value={userDetails.Firstname} onChange={handleChange} required className={inputCls} style={inputStyle} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <FieldLabel>Last Name</FieldLabel>
                                                    <input id="Lastname" name="Lastname" type="text" value={userDetails.Lastname} onChange={handleChange} required className={inputCls} style={inputStyle} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Contact */}
                                        <div className="border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>
                                            <SectionHeader dot="#a78bfa">CONTACT DETAILS</SectionHeader>
                                            <div className="grid grid-cols-2 gap-4 p-4">
                                                <div className="flex flex-col">
                                                    <FieldLabel>Email Address</FieldLabel>
                                                    <input id="Email" name="Email" type="email" value={userDetails.Email} onChange={handleChange} disabled className={inputCls} style={{ ...inputStyle, color: "rgba(255,255,255,0.3)", cursor: "default" }} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <FieldLabel>Contact Number</FieldLabel>
                                                    <input id="ContactNumber" name="ContactNumber" type="text" value={userDetails.ContactNumber} onChange={handleChange} className={inputCls} style={inputStyle} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Password */}
                                        <div className="border" style={{ borderColor: "rgba(255,255,255,0.07)", backgroundColor: "rgba(255,255,255,0.01)" }}>
                                            <SectionHeader dot="#fbbf24">PASSWORD CREDENTIALS</SectionHeader>
                                            <div className="flex flex-col gap-4 p-4">

                                                {/* New password */}
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <FieldLabel>New Password</FieldLabel>
                                                        <button
                                                            type="button"
                                                            onClick={handleGeneratePassword}
                                                            className="inline-flex items-center gap-1 text-[8px] uppercase tracking-widest transition-opacity hover:opacity-70"
                                                            style={{ color: "#fbbf24" }}
                                                        >
                                                            <RefreshCw className="h-2.5 w-2.5" /> GENERATE
                                                        </button>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            id="Password" name="Password"
                                                            type={showPassword ? "text" : "password"}
                                                            value={userDetails.Password || ""}
                                                            onChange={handleChange}
                                                            maxLength={10}
                                                            placeholder="NEW PASSWORD"
                                                            className={`${inputCls} pr-10`}
                                                            style={inputStyle}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                                                            style={{ color: "rgba(255,255,255,0.3)" }}
                                                        >
                                                            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>
                                                    {passwordStrength && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex gap-1">
                                                                {["weak", "medium", "strong"].map((s, i) => (
                                                                    <div
                                                                        key={s}
                                                                        className="h-1 w-8"
                                                                        style={{
                                                                            backgroundColor: ["weak", "medium", "strong"].indexOf(passwordStrength) >= i
                                                                                ? strengthColor
                                                                                : "rgba(255,255,255,0.08)",
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <span className="text-[9px] uppercase tracking-widest font-mono" style={{ color: strengthColor }}>
                                                                {passwordStrength}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Confirm password */}
                                                <div className="flex flex-col gap-1.5">
                                                    <FieldLabel>Confirm Password</FieldLabel>
                                                    <div className="relative">
                                                        <input
                                                            id="ContactPassword" name="ContactPassword"
                                                            type={showConfirmPassword ? "text" : "password"}
                                                            value={userDetails.ContactPassword || ""}
                                                            onChange={handleChange}
                                                            maxLength={10}
                                                            placeholder="CONFIRM PASSWORD"
                                                            className={`${inputCls} pr-10`}
                                                            style={inputStyle}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                                                            style={{ color: "rgba(255,255,255,0.3)" }}
                                                        >
                                                            {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </main>
                    </SidebarInset>
                    <SidebarRight
                        userId={userId ?? undefined}
                        dateCreatedFilterRange={dateCreatedFilterRange}
                        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
                    />
                </SidebarProvider>
            </FormatProvider>
        </UserProvider>
    );
}
