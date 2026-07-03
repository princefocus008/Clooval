/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroImage from "../assets/images/alu_campus_bg_1780756884172.jpg";
import { api } from "../lib/api";
import Logo from "./Logo";
import { Send, X, MessageCircle, Phone, Mail, MapPin, CheckCircle, ChevronDown } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  
  // Contact form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [formError, setFormError] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);



  const CONTACT_CATEGORIES = [
    "General Enquiry",
    "Service Question",
    "Complaint",
    "Partnership / Business",
    "Press / Media",
    "Other",
  ];

  const SUPPORT_CATEGORIES = [
    "General Support",
    "Repair Update",
    "Billing/Payment",
    "Other",
  ];

  const validateName = (value: string) => {
    if (!value || value.length < 2 || value.length > 100) {
      return "Name must be between 2 and 100 characters.";
    }
    return "";
  };

  const validateEmail = (value: string) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value || !emailPattern.test(value)) {
      return "A valid email address is required.";
    }
    return "";
  };

  const validateCategory = (value: string) => {
    if (!value) {
      return "Please select a category.";
    }
    return "";
  };

  const validateMessage = (value: string) => {
    if (!value || value.length < 10 || value.length > 1000) {
      return "Message must be between 10 and 1000 characters.";
    }
    return "";
  };

  const handleEmailBlur = () => {
    setEmailError(validateEmail(email));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nameValidation = validateName(name);
    const emailValidation = validateEmail(email);
    const categoryValidation = validateCategory(category);
    const messageValidation = validateMessage(message);

    setNameError(nameValidation);
    setEmailError(emailValidation);
    setCategoryError(categoryValidation);
    setMessageError(messageValidation);
    setFormError("");

    if (nameValidation || emailValidation || categoryValidation || messageValidation) {
      setFormError("Please fix the highlighted fields before sending.");
      return;
    }

    setIsSubmitting(true);
    try {
      console.debug("LandingPage: submitting contact", { name: name.trim(), email: email.trim(), category, message: message.trim() });
      const res = await api.post("/contact", {
        name: name.trim(),
        email: email.trim(),
        category,
        message: message.trim(),
      });
      console.debug("LandingPage: contact response", res.status, res.data);
      if (!res.data || res.data.success !== true) {
        setFormError(res.data?.error || "Something went wrong. Please try again or email us directly at cloovalcontact@gmail.com.");
        return;
      }

      setIsSuccess(true);
      setSubmittedEmail(email);
      setName("");
      setEmail("");
      setCategory("");
      setMessage("");
      setNameError("");
      setEmailError("");
      setCategoryError("");
      setMessageError("");
      setFormError("");
    } catch (error) {
      setFormError("Network error. Please try again or email us directly at cloovalcontact@gmail.com.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsSuccess(false);
    setSubmittedEmail("");
  };

  return (
    <div className="bg-white text-[#111111]">
      <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-[#E5E5E3] bg-white">
        <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-3 -ml-1">
              <Logo className="h-full" size="small" />
            </Link>
          <nav className="hidden items-center gap-8 text-[14px] font-medium text-[#555555] md:flex">
            <a href="#process" className="transition hover:text-[#111111]">How it works</a>
            <a href="#services" className="transition hover:text-[#111111]">For students</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#111111] px-5 text-[14px] font-medium text-white transition hover:bg-[#333333]"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main>
        <section
          className="relative min-h-screen bg-cover bg-center pt-16"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.55)]" />
          <div className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-[1100px] flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
            <div className="max-w-[720px]">
              <p className="mb-8 text-[11px] uppercase tracking-[2px] text-white/75">
                ALCHE · MAURITIUS
              </p>
              <h1 className="text-[36px] font-semibold leading-[1.1] tracking-[-1px] text-white sm:text-[56px]">
                Your campus.
                <br />
                Your items. Fixed.
              </h1>
              <p className="mt-6 max-w-[480px] text-[18px] leading-[1.6] text-white/75 sm:text-[18px]">
                Submit a request from your comfort. We handle the rest, no trips required.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  onClick={() => navigate("/login")}
                  className="inline-flex h-12 items-center justify-center rounded-[8px] bg-[#111111] px-[28px] text-[15px] font-medium text-white transition hover:bg-[#333333]"
                >
                  Get started
                </button>
                <button
                  onClick={() => document.getElementById("process")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex h-12 items-center justify-center rounded-[8px] border border-white/40 bg-white/15 px-[28px] text-[15px] font-medium text-white transition hover:bg-white/30"
                >
                  See how it works
                </button>
              </div>
            </div>
          </div>

          <div className="relative flex h-[64px] items-center justify-center bg-white">
            <div className="h-px w-full bg-[#E5E5E3] absolute left-0 top-0" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-[#999999]" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16.5L5.75 10.25L7.165 8.835L12 13.67L16.835 8.835L18.25 10.25L12 16.5Z" fill="currentColor" />
            </svg>
          </div>
        </section>

        <section className="bg-[#F7F7F5] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[900px]">
            <p className="mb-6 text-[12px] uppercase tracking-[0.8px] text-[#999999]">
              THE SITUATION
            </p>
            <h2 className="max-w-[780px] text-[28px] font-semibold leading-[1.2] tracking-[-0.5px] text-[#111111] sm:text-[36px]">
              Your phone breaks on a Tuesday.
              <br />
              You're still staring at it on Friday.
            </h2>
            <div className="my-8 h-px w-full bg-[#E5E5E3]" />
            <div className="space-y-6 text-[16px] leading-[1.7] text-[#555555]">
              <p>
                Port Louis is over an hour away. Transport costs money. Finding a trustworthy repair shop in a city where you don't speak the language is its own kind of stress. Most students just give up.
              </p>
              <p>
                We built Clooval because we watched this happen too many times. Cracked screens left unrepaired. Broken laptops abandoned. Torn clothes replaced instead of fixed. Not because students don't care, but because the system made it too hard.
              </p>
            </div>
            <div className="mt-8 border-l-[3px] border-[#111111] bg-[#F1F2E9] p-5 text-[16px] leading-[1.6] text-[#111111] font-medium">
              Clooval is the operator that sits between you and that long trip. You describe the problem. We handle everything else.
            </div>
            <div className="mt-12 grid gap-4 border-t border-[#E5E5E3] pt-12 sm:grid-cols-3 sm:gap-6">
              <div className="flex flex-col gap-2 border-r border-[#E5E5E3] pr-4 sm:border-r">
                <span className="text-[24px] font-semibold text-[#111111]">6 service categories</span>
                <span className="text-[13px] text-[#999999]">Phone, laptop, accessories and more</span>
              </div>
              <div className="flex flex-col gap-2 border-r border-[#E5E5E3] px-4 sm:border-r">
                <span className="text-[24px] font-semibold text-[#111111]">1 drop point</span>
                <span className="text-[13px] text-[#999999]">Right here on campus</span>
              </div>
              <div className="flex flex-col gap-2 pl-4 text-left sm:pl-0">
                <span className="text-[24px] font-semibold text-[#111111]">0 trips required</span>
                <span className="text-[13px] text-[#999999]">We coordinate the logistics</span>
              </div>
            </div>
          </div>
        </section>

        <section id="process" className="bg-white px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[12px] uppercase tracking-[0.8px] text-[#999999]">
              THE PROCESS
            </p>
            <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.5px] text-[#111111] sm:text-[32px]">
              Eazy flow of how Clooval works
            </h2>
            <p className="mt-4 max-w-[680px] text-[16px] leading-[1.7] text-[#555555]">
              Here is exactly what happens after you submit a request.
            </p>
            <div className="mt-10 space-y-10">
              {[
                {
                  number: "STEP 01",
                  title: "You submit a request",
                  description: "Select the service, describe the problem, upload a photo. Takes under 2 minutes.",
                },
                {
                  number: "STEP 02",
                  title: "We review and scout",
                  description: "The team reviews your request and contacts vetted providers in Port Louis on your behalf, in French or Creole.",
                },
                {
                  number: "STEP 03",
                  title: "You receive a quote",
                  description: "You get the total cost broken down clearly in the app. Accept or decline — no pressure.",
                },
                {
                  number: "STEP 04",
                  title: "Your item is collected",
                  description: "Drop your item at the campus collection point. A provider picks it up on the agreed date.",
                },
                {
                  number: "STEP 05",
                  title: "You collect it back fixed",
                  description: "Your repaired item comes back to campus. You collect it and pay the balance. Done.",
                },
              ].map((step) => (
                <div key={step.number} className="flex items-start gap-5">
                  <div className="relative flex h-full items-start">
                    <div className="mt-1 h-2 w-2 rounded-full bg-[#111111]" />
                    <div className="absolute left-0 top-4 h-[calc(100%-12px)] w-px bg-[#E5E5E3]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.8px] text-[#999999]">
                      {step.number}
                    </p>
                    <p className="mt-2 text-[16px] font-semibold text-[#111111]">
                      {step.title}
                    </p>
                    <p className="mt-2 max-w-[720px] text-[14px] leading-[1.6] text-[#555555]">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-12">
              <button
                onClick={() => navigate("/login")}
                className="inline-flex h-12 items-center justify-center rounded-[8px] bg-[#111111] px-[28px] text-[15px] font-medium text-white transition hover:bg-[#333333]"
              >
                Submit your first request
              </button>
              <p className="mt-3 max-w-[600px] text-[13px] text-[#999999]">
                No subscription. No hidden fees. Pay only when your item is fixed.
              </p>
            </div>
          </div>
        </section>

        <section id="services" className="bg-[#F7F7F5] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1100px]">
            <p className="mb-6 text-[12px] uppercase tracking-[0.8px] text-[#999999]">
              WHAT WE HANDLE
            </p>
            <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.5px] text-[#111111] sm:text-[32px]">
              Most things that break, we can fix.
            </h2>
            <div className="mt-10 grid gap-4 lg:grid-cols-[60%_40%]">
              <div className="flex min-h-[160px] flex-col justify-between rounded-[8px] border border-[#E5E5E3] bg-white p-6">
                <div>
                  <p className="text-[24px] font-semibold text-[#111111]">Phone Repair</p>
                  <p className="mt-3 max-w-[340px] text-[13px] text-[#999999] leading-[1.6]">
                    Screen · Battery · Charging port · Camera
                  </p>
                </div>
              </div>
              <div className="flex min-h-[160px] flex-col justify-between rounded-[8px] border border-[#E5E5E3] bg-white p-6">
                <div>
                  <p className="text-[24px] font-semibold text-[#111111]">Laptop Repair</p>
                  <p className="mt-3 max-w-[280px] text-[13px] text-[#999999] leading-[1.6]">
                    Screen · Keyboard · Software · Hinge
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              {[
                { title: "Clothing Alteration" },
                { title: "Shoe Repair" },
                { title: "Accessories" },
                { title: "Other" },
              ].map((item) => (
                <div key={item.title} className="rounded-[8px] border border-[#E5E5E3] bg-white p-4">
                  <p className="text-[13px] font-medium text-[#111111]">{item.title}</p>
                </div>
              ))}
            </div>
            <p className="mt-12 max-w-[700px] text-[14px] leading-[1.7] text-[#999999]">
              Don't see your service? Submit an 'Other' request and describe what you need, we'll figure it out.
            </p>
          </div>
        </section>

        <section className="bg-[#F1F2E9] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[800px]">
            <p className="mb-6 text-[12px] uppercase tracking-[0.8px] text-[#999999]">
              WHY STUDENTS TRUST CLOOVAL
            </p>
            <p className="max-w-[680px] text-[20px] font-medium leading-[1.5] tracking-[-0.3px] text-[#111111] sm:text-[24px]">
              We don't take a cut and disappear. Every request is personally handled by the team, the same person who picks up your calls and answers your messages.
            </p>
            <div className="my-8 h-px w-full bg-[#E5E5E3]" />
            <div className="space-y-4 border-t border-[#E5E5E3] pt-6">
              {[
                "Vetted providers only. Every partner is personally assessed before handling a student's item.",
                "Transparent pricing. You see the full cost before you commit. No surprises.",
                "Item protection. Every handoff is photographed and logged. There is always a record.",
              ].map((line) => (
                <div key={line} className="flex items-start gap-4 border-b border-[#E5E5E3] pb-4">
                  <div className="mt-2 h-2 w-2 rounded-full bg-[#111111]" />
                  <p className="text-[15px] font-medium leading-[1.6] text-[#111111]">{line}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <p className="text-[24px] font-semibold text-[#111111]">Ready to get something fixed?</p>
              <p className="mt-3 max-w-[620px] text-[16px] leading-[1.7] text-[#555555]">
        
              </p>
              <button
                onClick={() => navigate("/login")}
                className="mt-6 inline-flex h-12 items-center justify-center rounded-[8px] bg-[#111111] px-[28px] text-[15px] font-medium text-white transition hover:bg-[#333333]"
              >
                Create your account
              </button>
              <p className="mt-3 text-[13px] text-[#999999]">
                Free to join. No subscription required.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* GET IN TOUCH SECTION */}
      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid gap-12 lg:grid-cols-[40%_60%]">
            <div>
              <h2 className="text-[28px] font-semibold tracking-[-0.5px] text-[#111111] sm:text-[32px]">
                Get in touch.
              </h2>
              <p className="mt-4 text-[15px] leading-[1.7] text-[#555555]">
                Have a question? Something on your mind? We're here and we read every message.
              </p>

              <div className="mt-12 space-y-6">
                <div className="flex items-start gap-4">
                  <Mail size={20} className="text-[#555555] mt-1 shrink-0" />
                  <div>
                    <p className="text-[14px] font-semibold text-[#111111]">Email</p>
                    <p className="text-[14px] text-[#111111]">cloovalcontact@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Phone size={20} className="text-[#555555] mt-1 shrink-0" />
                  <div>
                    <p className="text-[14px] font-semibold text-[#111111]">Phone</p>
                    <p className="text-[14px] text-[#111111]">+230 5858 8285</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 border-b border-[#E5E5E3] pb-4">
                  <MapPin size={16} className="text-[#555555] mt-1" />
                  <p className="text-[14px] text-[#111111] leading-[1.5]">
                    7, Powder Mill Road, Pamplemousses, 21001, Mauritius
                  </p>
                </div>
              </div>

              <p className="max-w-[420px] text-[13px] italic text-[#555555] mt-6">
                We typically respond within a few hours.
              </p>
            </div>

            <div>
              {isSuccess ? (
                <div className="space-y-4 rounded-[8px] border border-[#E5E5E3] bg-white p-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={32} className="text-[#111111]" />
                    <div>
                      <p className="text-[18px] font-semibold text-[#111111]">Message received.</p>
                      <p className="mt-1 max-w-[420px] text-[14px] leading-[1.6] text-[#555555]">
                        We'll get back to you at {submittedEmail} shortly.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[13px] text-[#555555] hover:underline"
                  >
                    Send another message?
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[11px] uppercase tracking-[0.6px] text-[#999999]" htmlFor="contact-name">
                      YOUR NAME
                    </label>
                    <input
                      id="contact-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={`w-full border border-[#E5E5E3] bg-white px-3 text-[14px] text-[#111111] placeholder:text-[#999999] outline-none transition focus:border-2 focus:border-[#111111] ${nameError ? "border-[#111111]" : ""}`}
                      placeholder="Amara Osei"
                      type="text"
                      style={{ height: 40 }}
                    />
                    {nameError && <p className="mt-2 text-[12px] text-[#555555]">{nameError}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] uppercase tracking-[0.6px] text-[#999999]" htmlFor="contact-email">
                      EMAIL ADDRESS
                    </label>
                    <input
                      id="contact-email"
                      value={email}
                      onBlur={handleEmailBlur}
                      onChange={(event) => setEmail(event.target.value)}
                      className={`w-full border border-[#E5E5E3] bg-white px-3 text-[14px] text-[#111111] placeholder:text-[#999999] outline-none transition focus:border-2 focus:border-[#111111] ${emailError ? "border-[#111111]" : ""}`}
                      placeholder="your@email.com"
                      type="email"
                      style={{ height: 40 }}
                    />
                    {emailError && <p className="mt-2 text-[12px] text-[#555555]">{emailError}</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] uppercase tracking-[0.6px] text-[#999999]" htmlFor="contact-category">
                      CATEGORY
                    </label>
                    <div className="relative">
                      <select
                        id="contact-category"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className={`w-full appearance-none border border-[#E5E5E3] bg-white px-3 pr-10 text-[14px] text-[#111111] outline-none transition focus:border-2 focus:border-[#111111] ${categoryError ? "border-[#111111]" : ""}`}
                        style={{ height: 40 }}
                      >
                        <option value="" disabled>
                          Select a category
                        </option>
                        {CONTACT_CATEGORIES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#555555]" />
                    </div>
                    {categoryError && <p className="mt-2 text-[12px] text-[#555555]">{categoryError}</p>}
                  </div>

                  <div className="relative">
                    <label className="mb-2 block text-[11px] uppercase tracking-[0.6px] text-[#999999]" htmlFor="contact-message">
                      YOUR MESSAGE
                    </label>
                    <textarea
                      id="contact-message"
                      ref={messageRef}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      className={`w-full resize-none rounded-[8px] border border-[#E5E5E3] bg-white px-3 py-3 text-[14px] text-[#111111] placeholder:text-[#999999] outline-none transition focus:border-2 focus:border-[#111111] ${messageError ? "border-[#111111]" : ""}`}
                      placeholder="Tell us what's on your mind..."
                      style={{ minHeight: 120, maxHeight: 240 }}
                    />
                    <span className="pointer-events-none absolute right-3 bottom-3 text-[11px] text-[#999999]">
                      {message.length} / 1000
                    </span>
                    {messageError && <p className="mt-2 text-[12px] text-[#555555]">{messageError}</p>}
                  </div>

                  <div className="space-y-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex h-10 w-full items-center justify-center rounded-[8px] bg-[#111111] px-4 text-[14px] font-medium text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : (
                        "Send message"
                      )}
                    </button>
                    {formError && <p className="text-[13px] text-[#555555]">{formError}</p>}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#111111] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold">Clooval</p>
            <p className="mt-2 text-[12px] text-white/60">Campus Concierge · ALCHE, Mauritius</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8">
            <p className="text-[12px] text-white/40">© 2025 Clooval. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-4 text-[14px] text-white/60">
              <a href="#contact" className="transition hover:text-white">Contact</a>
              <a href="/login" className="transition hover:text-white">Log in</a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-[1100px] flex-col gap-10 pb-10 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:pb-12">
          <div className="space-y-3">
            <p className="text-[15px] font-semibold">Clooval</p>
            <p className="text-[11px] uppercase tracking-[0.8px] text-white/50">Campus Concierge</p>
            <p className="text-[12px] leading-[1.6] text-white/50">
              7, Powder Mill Road
              <br />
              Pamplemousses, 21001
              <br />
              Mauritius
            </p>
          </div>

          <div className="flex flex-col items-start justify-center text-center sm:items-center sm:text-center">
            <p className="text-[12px] text-white/40">© 2026 Clooval. All rights reserved.</p>
            <div className="mt-4 hidden h-px w-full bg-white/15 sm:block" />
          </div>

          <div className="flex flex-col gap-3 text-right sm:text-right">
            <p className="text-[13px] text-white/70">cloovalcontact@gmail.com</p>
            <p className="text-[13px] text-white/70">+230 5858 8285</p>
            <div className="flex flex-col gap-2 text-[13px] text-white/60">
              <a href="#process" className="transition hover:text-white hover:underline">How it works</a>
              <a href="/login" className="transition hover:text-white hover:underline">Log in</a>
            </div>
          </div>
        </div>
        <div className="mt-8 block border-t border-white/15 pt-6 text-center text-[12px] text-white/40 sm:hidden">
          © 2026 Clooval. All rights reserved.
        </div>
      </footer>

    </div>
  );
}
