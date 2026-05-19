"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
    const [Email,    setEmail]    = useState("");
    const [Password, setPassword] = useState("");
    const [loading,  setLoading]  = useState(false);

    const { setUserId } = useUser();
    const router = useRouter();

    const playSound = (file: string) => {
        const audio = new Audio(file);
        audio.play().catch(() => {});
    };

    const getDeviceId = () => {
        let deviceId = localStorage.getItem("deviceId");
        if (!deviceId) { deviceId = uuidv4(); localStorage.setItem("deviceId", deviceId); }
        return deviceId;
    };

    const getLocation = async () => {
        if (!navigator.geolocation) return null;
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject)
            );
            return { latitude: position.coords.latitude, longitude: position.coords.longitude };
        } catch { return null; }
    };

    const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!Email || !Password) { toast.error("All fields are required!"); return; }
        setLoading(true);
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ Email, Password }),
            });
            const text = await response.text();
            let result;
            try { result = JSON.parse(text); } catch {
                toast.error("Invalid server response.");
                playSound("/login-failed.mp3");
                setLoading(false);
                return;
            }
            if (!response.ok) {
                toast.error(result.message || "Login failed!");
                playSound("/reset.mp3");
                setLoading(false);
                return;
            }
            // ── Log activity ──────────────────────────────────────────────────
            const deviceId = getDeviceId();
            const location = await getLocation();
            await addDoc(collection(db, "activity_logs"), {
                email: Email,
                status: "login",
                timestamp: new Date().toISOString(),
                deviceId,
                location,
                userId: result.userId,
                browser: navigator.userAgent,
                os: navigator.platform,
                date_created: serverTimestamp(),
            });
            toast.success("Login successful!");
            playSound("/login.mp3");
            setUserId(result.userId);
            router.push(`/dashboard?id=${encodeURIComponent(result.userId)}`);
        } catch (error) {
            console.error("Login error:", error);
            toast.error("An error occurred during login.");
            playSound("/login-failed.mp3");
        } finally {
            setLoading(false);
        }
    }, [Email, Password, router, setUserId]);

    return (
        <div
            className={cn("font-mono", className)}
            {...props}
        >
            {/* Full-screen background */}
            <div
                className="fixed inset-0"
                style={{ backgroundColor: "#080c10", zIndex: 0 }}
            />
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
                                style={{ backgroundColor: "#34d399", boxShadow: "0 0 5px #34d399" }}
                            />
                            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                                AUTHENTICATION
                            </span>
                        </div>
                        <p className="text-[9px] uppercase tracking-widest pl-3.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                            Enter credentials to access the system
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                        {/* Email */}
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="email"
                                className="text-[9px] uppercase tracking-[0.15em]"
                                style={{ color: "rgba(255,255,255,0.3)" }}
                            >
                                EMAIL ADDRESS
                            </label>
                            <div className="relative">
                                <span
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none"
                                    style={{ color: "rgba(255,255,255,0.2)" }}
                                >
                                    ›
                                </span>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="user@stash.com"
                                    required
                                    value={Email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-6 pr-3 py-2 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors"
                                    style={{
                                        backgroundColor: "rgba(255,255,255,0.03)",
                                        borderColor: "rgba(255,255,255,0.1)",
                                        color: "rgba(255,255,255,0.7)",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor="password"
                                    className="text-[9px] uppercase tracking-[0.15em]"
                                    style={{ color: "rgba(255,255,255,0.3)" }}
                                >
                                    PASSWORD
                                </label>
                                <Link
                                    href="/reset-password"
                                    className="text-[9px] uppercase tracking-widest transition-opacity hover:opacity-70"
                                    style={{ color: "#fb923c" }}
                                >
                                    FORGOT?
                                </Link>
                            </div>
                            <div className="relative">
                                <span
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono select-none"
                                    style={{ color: "rgba(255,255,255,0.2)" }}
                                >
                                    ›
                                </span>
                                <input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={Password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-6 pr-3 py-2 text-[11px] font-mono border outline-none placeholder:opacity-25 transition-colors"
                                    style={{
                                        backgroundColor: "rgba(255,255,255,0.03)",
                                        borderColor: "rgba(255,255,255,0.1)",
                                        color: "rgba(255,255,255,0.7)",
                                    }}
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                            style={{
                                backgroundColor: loading ? "rgba(251,146,60,0.1)" : "#fb923c",
                                borderColor: loading ? "rgba(251,146,60,0.3)" : "transparent",
                                color: loading ? "#fb923c" : "#000",
                            }}
                        >
                            {loading ? "AUTHENTICATING..." : "LOGIN →"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

                    {/* Sign up link */}
                    <p className="text-center text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                        NO ACCOUNT?{" "}
                        <Link
                            href="/auth/signup"
                            className="transition-opacity hover:opacity-70"
                            style={{ color: "#fb923c" }}
                        >
                            SIGN UP
                        </Link>
                    </p>
                </div>

                {/* Footer note */}
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
