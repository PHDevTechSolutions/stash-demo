"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator, FieldSet, FieldContent, FieldTitle, } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
    const [Email, setEmail] = useState("");
    const [Password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [lockUntil, setLockUntil] = useState<string | null>(null);
    const [formattedLockUntil, setFormattedLockUntil] = useState<string | null>(null);

    const { setUserId } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (lockUntil) {
            setFormattedLockUntil(new Date(lockUntil).toLocaleString());
        }
    }, [lockUntil]);

    const playSound = (file: string) => {
        const audio = new Audio(file);
        audio.play().catch(() => { });
    };

    const getDeviceId = () => {
        let deviceId = localStorage.getItem("deviceId");
        if (!deviceId) {
            deviceId = uuidv4();
            localStorage.setItem("deviceId", deviceId);
        }
        return deviceId;
    };

    const getLocation = async () => {
        if (!navigator.geolocation) return null;
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject)
            );
            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            };
        } catch {
            console.warn("User denied location access");
            return null;
        }
    };

    const isLoginAllowed = () => {
        const now = new Date();
        const phTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
        const hour = phTime.getHours();
        return hour >= 7 && hour < 19;
    };

    const handleSubmit = useCallback(
        async (e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();

            if (!Email || !Password) {
                toast.error("All fields are required!");
                return;
            }

            if (!isLoginAllowed()) {
                toast.error("⏰ Login is only allowed between 7:00 AM and 7:00 PM (Philippine time).");
                return;
            }

            setLoading(true);
            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ Email, Password }),
                });

                const text = await response.text();
                let result;

                try {
                    result = JSON.parse(text);
                } catch {
                    toast.error("Invalid server response.");
                    playSound("/login-failed.mp3");
                    setLoading(false);
                    return;
                }

                if (!response.ok) {
                    if (result.lockUntil) {
                        setLockUntil(result.lockUntil);
                        toast.error(
                            `Account locked! Try again after ${new Date(result.lockUntil).toLocaleString()}.`
                        );
                    } else {
                        toast.error(result.message || "Login failed!");
                    }
                    playSound("/reset.mp3");
                    setLoading(false);
                    return;
                }

                // ✅ SUCCESS — log activity
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

                setLoading(false);
            } catch (error) {
                console.error("Login error:", error);
                toast.error("An error occurred during login.");
                playSound("/login-failed.mp3");
                setLoading(false);
            }
        },
        [Email, Password, router, setUserId]
    );

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden p-0">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form onSubmit={handleSubmit} className="p-6 md:p-8">
                        <FieldGroup>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h1 className="text-2xl font-bold">Welcome back</h1>
                                <p className="text-muted-foreground text-balance">
                                    Login to your Stash account
                                </p>
                            </div>
                            <Field>
                                <FieldLabel htmlFor="email">Email</FieldLabel>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@stash.com"
                                    required
                                    value={Email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </Field>
                            <Field>
                                <div className="flex items-center">
                                    <FieldLabel htmlFor="password">Password</FieldLabel>
                                    <a
                                        href="/reset-password"
                                        className="ml-auto text-sm underline-offset-2 hover:underline"
                                    >
                                        Forgot your password?
                                    </a>

                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    value={Password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </Field>

                            {/* Department section removed */}

                            <Field>
                                <Button type="submit" disabled={loading} className="w-full">
                                    {loading ? "Signing in..." : "Login"}
                                </Button>
                            </Field>

                            <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                                Or continue with
                            </FieldSeparator>
                            <FieldDescription className="text-center">
                                Don&apos;t have an account? <Link href="/auth/signup" className="text-primary hover:underline">
                                    Sign up
                                </Link>
                            </FieldDescription>
                        </FieldGroup>
                    </form>
                    <div className="bg-muted relative hidden md:block">
                        <img
                            src="/asset.jpg"
                            alt="Image"
                            className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
                        />
                    </div>
                </CardContent>
            </Card>
            <FieldDescription className="px-6 text-center">
                By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
                and <a href="#">Privacy Policy</a>.
            </FieldDescription>
        </div>
    );
}
