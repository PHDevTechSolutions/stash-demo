"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [email,          setEmail]          = useState("");
    const [emailVerified,  setEmailVerified]  = useState(false);
    const [loading,        setLoading]        = useState(false);
    const [newPassword,    setNewPassword]    = useState("");
    const [confirmPassword,setConfirmPassword]= useState("");
    const [passwordsMatch, setPasswordsMatch] = useState(true);

    useEffect(() => {
        if (newPassword && confirmPassword) {
            setPasswordsMatch(newPassword === confirmPassword);
        } else {
            setPasswordsMatch(true);
        }
    }, [newPassword, confirmPassword]);

    const handleVerifyEmail = async () => {
        if (!email) { toast.error("Please enter your email."); return; }
        setLoading(true);
        try {
            const res = await fetch("/api/check-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (res.ok) {
                toast.success("Email found. Please enter your new password.");
                setEmailVerified(true);
            } else {
                const data = await res.json();
                toast.error(data.message || "Email not found.");
            }
        } catch {
            toast.error("An error occurred while verifying email.");
        }
        setLoading(false);
    };

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) { toast.error("Please fill in both password fields."); return; }
        if (!passwordsMatch) { toast.error("Passwords do not match."); return; }
        setLoading(true);
        try {
            const res = await fetch("/api/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, newPassword }),
            });
            if (res.ok) {
                toast.success("Password reset successfully. Redirecting to login...");
                setEmail(""); setNewPassword(""); setConfirmPassword(""); setEmailVerified(false);
                setTimeout(() => router.push("/auth/login"), 1500);
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to reset password.");
            }
        } catch {
            toast.error("An error occurred while resetting password.");
        }
        setLoading(false);
    };

    const inputCls = "w-full pl-6 pr-3 py-2 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors disabled:opacity-40";
    const inputStyle: React.CSSProperties = {
        backgroundColor: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.7)",
    };
    const inputErrorStyle: React.CSSProperties = {
        ...inputStyle,
        borderColor: "rgba(248,113,113,0.4)",
    };

    return (
        <div className="font-mono">
            {/* Full-screen background */}
            <div className="fixed inset-0" style={{ backgroundColor: "#080c10", zIndex: 0 }} />
            {/* Dot grid */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    zIndex: 1,
                }}
            />

            {/* Centering wrapper */}
            <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
                <div className="w-full max-w-sm px-4">

                    {/* Logo mark */}
                    <div className="flex flex-col items-center gap-3 mb-8">
                        <div
                            className="flex items-center justify-center w-10 h-10 border font-bold text-base"
                            style={{
                                backgroundColor: "rgba(251,146,60,0.1)",
                                borderColor: "rgba(251,146,60,0.3)",
                                color: "#fb923c",
                                boxShadow: "0 0 16px rgba(251,146,60,0.15)",
                            }}
                        >
                            S
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] uppercase tracking-[0.25em] font-bold" style={{ color: "#fb923c" }}>
                                STASH
                            </p>
                            <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                                IT ASSET INVENTORY SYSTEM
                            </p>
                        </div>
                    </div>

                    {/* Card */}
                    <div
                        className="border p-6 flex flex-col gap-5"
                        style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
                    >
                        {/* Header */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span
                                    className="inline-flex w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: "#fb923c", boxShadow: "0 0 5px #fb923c" }}
                                />
                                <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                                    RESET PASSWORD
                                </span>
                            </div>
                            <p className="text-[9px] uppercase tracking-widest pl-3.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                                {emailVerified
                                    ? "Enter and confirm your new password"
                                    : "Verify your email address to continue"}
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

                        <div className="flex flex-col gap-4">

                            {/* Email field */}
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="email" className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                    EMAIL ADDRESS
                                </label>
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none" style={{ color: "rgba(255,255,255,0.2)" }}>›</span>
                                    <input
                                        id="email"
                                        type="email"
                                        placeholder="user@stash.com"
                                        value={email}
                                        disabled={emailVerified}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className={inputCls}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* Verify button */}
                            {!emailVerified && (
                                <button
                                    onClick={handleVerifyEmail}
                                    disabled={loading || !email}
                                    className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{
                                        backgroundColor: loading ? "rgba(251,146,60,0.1)" : "#fb923c",
                                        borderColor: loading ? "rgba(251,146,60,0.3)" : "transparent",
                                        color: loading ? "#fb923c" : "#000",
                                    }}
                                >
                                    {loading ? "VERIFYING..." : "VERIFY EMAIL →"}
                                </button>
                            )}

                            {/* Password fields — shown after email verified */}
                            {emailVerified && (
                                <>
                                    {/* New password */}
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="new-password" className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                            NEW PASSWORD
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none" style={{ color: "rgba(255,255,255,0.2)" }}>›</span>
                                            <input
                                                id="new-password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className={inputCls}
                                                style={!passwordsMatch && confirmPassword ? inputErrorStyle : inputStyle}
                                            />
                                        </div>
                                    </div>

                                    {/* Confirm password */}
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="confirm-password" className="text-[9px] uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                            CONFIRM PASSWORD
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none" style={{ color: "rgba(255,255,255,0.2)" }}>›</span>
                                            <input
                                                id="confirm-password"
                                                type="password"
                                                placeholder="••••••••"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className={inputCls}
                                                style={!passwordsMatch && confirmPassword ? inputErrorStyle : inputStyle}
                                            />
                                        </div>
                                        {!passwordsMatch && confirmPassword && (
                                            <p className="text-[9px] uppercase tracking-widest font-mono" style={{ color: "#f87171" }}>
                                                PASSWORDS DO NOT MATCH
                                            </p>
                                        )}
                                    </div>

                                    {/* Submit */}
                                    <button
                                        onClick={handleResetPassword}
                                        disabled={loading || !newPassword || !confirmPassword || !passwordsMatch}
                                        className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                                        style={{
                                            backgroundColor: loading ? "rgba(251,146,60,0.1)" : "#fb923c",
                                            borderColor: loading ? "rgba(251,146,60,0.3)" : "transparent",
                                            color: loading ? "#fb923c" : "#000",
                                        }}
                                    >
                                        {loading ? "RESETTING..." : "RESET PASSWORD →"}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

                        {/* Back to login */}
                        <p className="text-center text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                            REMEMBER YOUR PASSWORD?{" "}
                            <Link href="/auth/login" className="transition-opacity hover:opacity-70" style={{ color: "#fb923c" }}>
                                LOGIN
                            </Link>
                        </p>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-[8px] uppercase tracking-widest mt-4" style={{ color: "rgba(255,255,255,0.12)" }}>
                        By continuing you agree to our{" "}
                        <a href="#" className="underline underline-offset-2">Terms</a>
                        {" "}and{" "}
                        <a href="#" className="underline underline-offset-2">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
