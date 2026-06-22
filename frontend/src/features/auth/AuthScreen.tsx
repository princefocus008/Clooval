/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore, useToastStore } from "../../lib/store";
import { api } from "../../lib/api";
import { saveLocalUser, syncLocalStorageWithServer } from "../../lib/sync";
import { Eye, EyeOff, ChevronLeft } from "lucide-react";
import loginBg from "../../assets/images/alu_campus_bg_1780756884172.jpg";
import Logo from "../../components/Logo";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

// Register schema
const registerSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z
    .string()
    .email("Enter a valid email address")
    .refine(
      (email) => {
        const lower = email.toLowerCase();
        return lower.endsWith("@alustudent.com") || lower.endsWith("@alueducation.com") || lower.endsWith("alueducation.com") || lower === "admin@cloova.com";
      },
      { message: "Must end with @alustudent.com or @alueducation.com" }
    ),
  phone: z.string().min(6, "A valid phone/WhatsApp number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  passwordConfirm: z.string().min(6, "Confirm password must be at least 6 characters"),
  nationality: z.string().optional(),
  programmeOfStudy: z.string().optional(),
  resident: z.enum(["Maps", "Songhai", "Aksum"], {
    message: "Select residential block"
  }),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Passwords do not match",
  path: ["passwordConfirm"],
});

type RegisterInput = z.infer<typeof registerSchema>;

// Login schema
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginInput = z.infer<typeof loginSchema>;

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { addToast } = useToastStore();

  // Register Form
  const {
    register: regField,
    handleSubmit: handleRegSubmit,
    formState: { errors: regErrors },
    reset: resetReg,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  // Login Form
  const {
    register: logField,
    handleSubmit: handleLogSubmit,
    formState: { errors: logErrors },
    reset: resetLog,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onLoginSubmit = async (data: LoginInput) => {
    setLoading(true);
    try {
      // Sync local users first to support server restarts
      await syncLocalStorageWithServer();
      
      const res = await api.post("/auth/login", data);
      login(res.data.user, res.data.token);
      addToast(`Welcome back, ${res.data.user.name}!`, "success");
      // allow toast + micro-animation to be perceived, then navigate
      setLoading(false);
      setTimeout(() => {
        if (res.data.user.role === "admin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/app", { replace: true });
        }
      }, 180);
    } catch (err: any) {
      setLoading(false);
      const msg = err.response?.data?.error || "Incorrect login email or password";
      addToast(msg, "error");
    }
  };

  const onRegisterSubmit = async (data: RegisterInput) => {
    setLoading(true);
    try {
      // Send the clean signup data directly
      const res = await api.post("/auth/register", data);
      
      // Save info locally in local storage for sync restoration across container reboots
      saveLocalUser(res.data.user, data.password);
      
      login(res.data.user, res.data.token);
      addToast("Account created successfully. Welcome to Cloova!", "success");
      // allow toast + micro-animation to be perceived, then navigate
      setLoading(false);
      setTimeout(() => {
        if (res.data.user.role === "admin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/app", { replace: true });
        }
      }, 180);
    } catch (err: any) {
      setLoading(false);
      const msg = err.response?.data?.error || "Registration failed. Try again.";
      addToast(msg, "error");
    }
  };

  const toggleTab = (loginTab: boolean) => {
    setIsLogin(loginTab);
    resetReg();
    resetLog();
  };

  return (
    <div className="w-full min-h-screen grid grid-cols-1 md:grid-cols-2 bg-white relative">
      {/* Premium Fullscreen Secure loading screen overlay */}
      {loading && (
        <div className="fixed inset-0 bg-[#FAF9F6]/85 backdrop-blur-md z-50 flex flex-col justify-center items-center gap-4 animate-fade-in">
          <LoadingSpinner size="lg" />
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] font-sans text-neutral-800 animate-pulse">
            Authenticating Secure Student Portal...
          </p>
        </div>
      )}

      {/* LEFT COLUMN: THE AUTHENTICATION FORM */}
      <div className="flex flex-col justify-center items-center px-6 sm:px-12 md:px-16 lg:px-24 py-10 relative z-10">
        <div className={`w-full ${isLogin ? "max-w-[390px]" : "max-w-[480px]"} flex flex-col transition-all duration-300`}>
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#111111] hover:text-[#333333]"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Link>
          {/* LOGO: Beautiful, modern geometric component brand mark */}
          <Logo className="mb-8" to="/" />

          <h1 id="auth-title" className="text-3xl font-black tracking-tight text-[#111111] mb-2 font-sans select-none">
            {isLogin ? "WELCOME BACK" : "JOIN CLOOVA"}
          </h1>
          <p className="text-sm text-[#777777] mb-8">
            {isLogin
              ? "Welcome back student! Please enter your details."
              : "Create your student repair profile to get started."}
          </p>

          {isLogin ? (
            /* ==========================================
               LOGIN FORM (MATCHING THE ORIGINAL PIC WITH BLACK BUTTONS)
               ========================================== */
            <form onSubmit={handleLogSubmit(onLoginSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="c.ejeh@alustudent.com"
                  className={`w-full h-11 px-4 bg-[#F8F9FA] border rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85 ${
                    logErrors.email ? "border-2 border-[#E74C3C]" : "border-gray-200"
                  }`}
                  {...logField("email")}
                />
                {logErrors.email && (
                  <p className="text-xs text-[#E74C3C] mt-1.5">{logErrors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="**********"
                    className={`w-full h-11 pl-4 pr-11 bg-[#F8F9FA] border rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85 ${
                      logErrors.password ? "border-2 border-[#E74C3C]" : "border-gray-200"
                    }`}
                    {...logField("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {logErrors.password && (
                  <p className="text-xs text-[#E74C3C] mt-1.5">{logErrors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 select-none">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4.5 h-4.5 rounded border-gray-300 text-[#111111] focus:ring-[#111111] focus:ring-offset-0"
                  />
                  <span className="text-sm font-medium text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm font-semibold text-gray-700 hover:text-black hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-[#111111] hover:bg-black active:bg-[#111111] text-white font-medium rounded-xl text-sm transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-semibold"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Sign in"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => addToast("Google authentication is simulated for student login.", "info")}
                  className="w-full h-11 border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl text-sm transition flex items-center justify-center gap-3 shadow-none animate-fade-in"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-8 select-none">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => toggleTab(false)}
                  className="text-[#111111] font-semibold hover:underline"
                >
                  Sign up for free!
                </button>
              </p>
            </form>
          ) : (
            /* ==========================================
               REGISTER FORM (UPGRADED WITH ALL NEW VISUALS & FIELDS)
               ========================================== */
            <form onSubmit={handleRegSubmit(onRegisterSubmit)} className="space-y-4">
              
              {/* Full Name & Student Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Amara Diop"
                    className={`w-full h-11 px-4 bg-[#F8F9FA] border rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85 ${
                      regErrors.name ? "border-2 border-[#E74C3C]" : "border-gray-200"
                    }`}
                    {...regField("name")}
                  />
                  {regErrors.name && (
                    <p className="text-xs text-[#E74C3C] mt-1.2">{regErrors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Alu Student Email
                  </label>
                  <input
                    type="email"
                    placeholder="c.ejeh@alustudent.com"
                    className={`w-full h-11 px-4 bg-[#F8F9FA] border rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85 ${
                      regErrors.email ? "border-2 border-[#E74C3C]" : "border-gray-200"
                    }`}
                    {...regField("email")}
                  />
                  {regErrors.email && (
                    <p className="text-xs text-[#E74C3C] mt-1.2">{regErrors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className={`w-full h-11 pl-4 pr-11 bg-[#F8F9FA] border rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85 ${
                        regErrors.password ? "border-2 border-[#E74C3C]" : "border-gray-200"
                      }`}
                      {...regField("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regErrors.password && (
                    <p className="text-xs text-[#E74C3C] mt-1.2">{regErrors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className={`w-full h-11 pl-4 pr-11 bg-[#F8F9FA] border rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85 ${
                        regErrors.passwordConfirm ? "border-2 border-[#E74C3C]" : "border-gray-200"
                      }`}
                      {...regField("passwordConfirm")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regErrors.passwordConfirm && (
                    <p className="text-xs text-[#E74C3C] mt-1.2">{regErrors.passwordConfirm.message}</p>
                  )}
                </div>
              </div>

              {/* WhatsApp & Resident */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Phone (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    placeholder="+230 5111 2233"
                    className={`w-full h-11 px-4 bg-[#F8F9FA] border rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85 ${
                      regErrors.phone ? "border-2 border-[#E74C3C]" : "border-gray-200"
                    }`}
                    {...regField("phone")}
                  />
                  {regErrors.phone && (
                    <p className="text-xs text-[#E74C3C] mt-1.2">{regErrors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                    Resident
                  </label>
                  <div className="relative">
                    <select
                      className={`w-full h-11 pl-4 pr-10 bg-[#F8F9FA] border rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85 appearance-none cursor-pointer ${
                        regErrors.resident ? "border-2 border-[#E74C3C]" : "border-gray-200"
                      }`}
                      {...regField("resident")}
                    >
                      <option value="">Select estate...</option>
                      <option value="Maps">Maps</option>
                      <option value="Songhai">Songhai</option>
                      <option value="Aksum">Aksum</option>
                    </select>
                    {/* Visual down arrow for select dropdown */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                  {regErrors.resident && (
                    <p className="text-xs text-[#E74C3C] mt-1.2">{regErrors.resident.message}</p>
                  )}
                </div>
              </div>

              {/* Optional Fields: Nationality (Optional) & Programme of study (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[13px] font-semibold text-gray-700">
                      Nationality / Country
                    </label>
                    <span className="text-[10px] text-gray-400 font-medium">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Mauritian"
                    className="w-full h-11 px-4 bg-[#F8F9FA] border border-gray-200 rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85"
                    {...regField("nationality")}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[13px] font-semibold text-gray-700">
                      Programme of Study
                    </label>
                    <span className="text-[10px] text-gray-400 font-medium">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Software Engineering"
                    className="w-full h-11 px-4 bg-[#F8F9FA] border border-gray-200 rounded-xl text-sm text-black transition focus:bg-white focus:border-2 focus:border-[#111111] focus:outline-none placeholder:text-[#9CA3AF] placeholder:opacity-85"
                    {...regField("programmeOfStudy")}
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-[#111111] hover:bg-black active:bg-[#111111] text-white font-medium rounded-xl text-sm transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md font-semibold"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Register to free"
                  )}
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-6 select-none">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => toggleTab(true)}
                  className="text-[#111111] font-semibold hover:underline"
                >
                  Sign in here
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: THE BEAUTIFUL MAURITIUS ALU CAMPUS PHOTO (DESKTOP ONLY) */}
      <div className="hidden md:flex bg-[#F5F5F3] justify-center items-center relative overflow-hidden h-full p-8 lg:p-12 border-l border-neutral-200/50">
        {/* Dynamic decorative visual depth backdrops */}
        <div className="absolute top-[-20%] left-[-20%] w-[65%] h-[65%] rounded-full bg-gradient-to-tr from-neutral-200/30 to-green-150/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-gradient-to-br from-neutral-300/20 to-neutral-500/10 blur-[110px] pointer-events-none" />

        {/* Master Aesthetic Photo Container Frame */}
        <div className="relative w-full h-full rounded-[32px] overflow-hidden shadow-2xl border border-neutral-300/40 group flex flex-col justify-end">
          {/* Ambient smooth zoom on hover */}
          <img
            src={loginBg}
            alt="Cloova login page background"
            className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-[12000ms] ease-out scale-100 group-hover:scale-108 pointer-events-none"
            referrerPolicy="no-referrer"
          />
          
          {/* Subtle gradient overlay to provide text readability background at the bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 transition-opacity duration-500" />
          
          {/* Floating Premium Label Top Right */}
          <div className="absolute top-6 right-6 z-20 bg-white/95 backdrop-blur-md px-4 py-2 rounded-full border border-neutral-200 shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-[#111111] tracking-wider font-mono">
              Cloova Services
            </span>
          </div>

          {/* Elegant Copywriting floating details */}
          <div className="relative z-10 p-8 lg:p-10 text-white max-w-lg select-none">
            {/* Minimal line node to signify "Cloova" connection */}
            <div className="w-12 h-[3px] bg-white rounded-full mb-5 opacity-90" />
            
            <p className="text-[28px] lg:text-[32px] font-black tracking-tight leading-tight mb-3 font-sans text-white">
              Smarter repairs. Seamless campus living.
            </p>
            
            <p className="text-sm lg:text-[15px] font-medium text-white/80 leading-relaxed max-w-md">
              Submit hardware, lock, or tailoring repair needs directly. We connect you with vetted Mauritius repair specialists and handle campus collection.
            </p>

            <div className="mt-8 flex items-center gap-3">
              {/* Overlapping small avatar indicators representing Cloova network */}
              <div className="flex -space-x-2">
                <span className="w-6.5 h-6.5 rounded-full border border-white bg-neutral-800 flex items-center justify-center text-[8px] font-extrabold font-mono text-white">AM</span>
                <span className="w-6.5 h-6.5 rounded-full border border-white bg-neutral-700 flex items-center justify-center text-[8px] font-extrabold font-mono text-neutral-100">KW</span>
                <span className="w-6.5 h-6.5 rounded-full border border-white bg-neutral-900 flex items-center justify-center text-[8px] font-extrabold font-mono text-neutral-200">CE</span>
              </div>
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-widest leading-none">
                Vetted by 350+ ALU Students
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
