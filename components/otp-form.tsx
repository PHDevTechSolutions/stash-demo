"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";

export function OTPForm({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("font-mono", className)}
            {...props}
        >
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
                                    VERIFICATION
                                </span>
                            </div>
                            <p className="text-[9px] uppercase tracking-widest pl-3.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                                Enter the 6-digit code sent to your email
                            </p>
                        </div>

                        {/* Divider */}
                        <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

                        <form className="flex flex-col gap-5">
                            {/* OTP slots */}
                            <div className="flex justify-center">
                                <InputOTP maxLength={6} id="otp" required containerClassName="gap-3">
                                    <InputOTPGroup
                                        className={[
                                            "gap-2",
                                            "[&_[data-slot=input-otp-slot]]:h-14",
                                            "[&_[data-slot=input-otp-slot]]:w-11",
                                            "[&_[data-slot=input-otp-slot]]:border",
                                            "[&_[data-slot=input-otp-slot]]:text-lg",
                                            "[&_[data-slot=input-otp-slot]]:font-mono",
                                            "[&_[data-slot=input-otp-slot]]:font-bold",
                                            "[&_[data-slot=input-otp-slot]]:bg-[rgba(255,255,255,0.03)]",
                                            "[&_[data-slot=input-otp-slot]]:border-[rgba(255,255,255,0.1)]",
                                            "[&_[data-slot=input-otp-slot]]:text-[#fb923c]",
                                            "[&_[data-slot=input-otp-slot][data-active=true]]:border-[rgba(251,146,60,0.5)]",
                                            "[&_[data-slot=input-otp-slot][data-active=true]]:bg-[rgba(251,146,60,0.06)]",
                                        ].join(" ")}
                                    >
                                        <InputOTPSlot index={0} />
                                        <InputOTPSlot index={1} />
                                        <InputOTPSlot index={2} />
                                    </InputOTPGroup>
                                    <InputOTPSeparator>
                                        <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
                                    </InputOTPSeparator>
                                    <InputOTPGroup
                                        className={[
                                            "gap-2",
                                            "[&_[data-slot=input-otp-slot]]:h-14",
                                            "[&_[data-slot=input-otp-slot]]:w-11",
                                            "[&_[data-slot=input-otp-slot]]:border",
                                            "[&_[data-slot=input-otp-slot]]:text-lg",
                                            "[&_[data-slot=input-otp-slot]]:font-mono",
                                            "[&_[data-slot=input-otp-slot]]:font-bold",
                                            "[&_[data-slot=input-otp-slot]]:bg-[rgba(255,255,255,0.03)]",
                                            "[&_[data-slot=input-otp-slot]]:border-[rgba(255,255,255,0.1)]",
                                            "[&_[data-slot=input-otp-slot]]:text-[#fb923c]",
                                            "[&_[data-slot=input-otp-slot][data-active=true]]:border-[rgba(251,146,60,0.5)]",
                                            "[&_[data-slot=input-otp-slot][data-active=true]]:bg-[rgba(251,146,60,0.06)]",
                                        ].join(" ")}
                                    >
                                        <InputOTPSlot index={3} />
                                        <InputOTPSlot index={4} />
                                        <InputOTPSlot index={5} />
                                    </InputOTPGroup>
                                </InputOTP>
                            </div>

                            {/* Resend */}
                            <p className="text-center text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                                DIDN&apos;T RECEIVE THE CODE?{" "}
                                <a href="#" className="transition-opacity hover:opacity-70" style={{ color: "#fb923c" }}>
                                    RESEND
                                </a>
                            </p>

                            {/* Submit */}
                            <button
                                type="submit"
                                className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest border font-mono transition-all duration-150"
                                style={{ backgroundColor: "#fb923c", borderColor: "transparent", color: "#000" }}
                            >
                                VERIFY →
                            </button>
                        </form>
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
