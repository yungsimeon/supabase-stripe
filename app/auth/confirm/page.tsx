"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthConfirmPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const handleAuthConfirmation = async () => {
      try {
        const code = searchParams.get("code");
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");

        console.log("🔗 Auth confirm params:", {
          code,
          tokenHash,
          type,
          errorParam: searchParams.get("error"),
          errorDescription: searchParams.get("error_description"),
        });

        if (code) {
          console.log("🔐 Magic link detected, setting up auth listener...");

          // Listen for auth state changes
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("🔐 Auth state change:", event, session?.user?.email);

            if (event === "SIGNED_IN" && session?.user) {
              console.log("✅ User signed in:", session.user.email);
              router.push("/dashboard");
              subscription.unsubscribe();
            }
          });

          // Also check for existing session
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session && sessionData.session.user) {
            console.log(
              "✅ Session already exists:",
              sessionData.session.user.email
            );
            router.push("/dashboard");
            subscription.unsubscribe();
          }
        } else if (tokenHash && type) {
          // Handle OTP verification for other auth types
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });

          if (error) {
            setError(error.message);
          } else if (data.user) {
            // Successfully confirmed, redirect to dashboard
            router.push("/dashboard");
          }
        } else {
          setError("Invalid confirmation link");
        }
      } catch (err) {
        console.error("Auth confirmation error:", err);
        setError("An error occurred during confirmation");
      } finally {
        setLoading(false);
      }
    };

    handleAuthConfirmation();
  }, [searchParams, supabase.auth, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Confirming your email...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Confirmation Error
            </h2>
            <p className="mt-2 text-center text-sm text-red-600">{error}</p>
          </div>
          <div className="mt-8">
            <button
              onClick={() => router.push("/login")}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-green-600 mb-4">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Email Confirmed!
        </h2>
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
