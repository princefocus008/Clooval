/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import heroImage from "../assets/images/alu_campus_bg_1780756884172.jpg";
import Logo from "./Logo";

export default function LandingPage() {
  const navigate = useNavigate();

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
                Submit a repair request from your room. We handle the rest, no trips to Port Louis required.
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
                We built Cloova because we watched this happen too many times. Cracked screens left unrepaired. Broken laptops abandoned. Torn clothes replaced instead of fixed. Not because students don't care, but because the system made it too hard.
              </p>
            </div>
            <div className="mt-8 border-l-[3px] border-[#111111] bg-[#F1F2E9] p-5 text-[16px] leading-[1.6] text-[#111111] font-medium">
              Cloova is the operator that sits between you and Port Louis. You describe the problem. We handle everything else.
            </div>
            <div className="mt-12 grid gap-4 border-t border-[#E5E5E3] pt-12 sm:grid-cols-3 sm:gap-6">
              <div className="flex flex-col gap-2 border-r border-[#E5E5E3] pr-4 sm:border-r">
                <span className="text-[24px] font-semibold text-[#111111]">6 service categories</span>
                <span className="text-[13px] text-[#999999]">Phone, laptop, clothing and more</span>
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
              From broken to back in your hands.
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
                  description: "The team reviews your request and contacts vetted providers in Port Louis on your behalf — in French or Creole.",
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
              WHY STUDENTS TRUST CLOOVA
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

      <footer className="bg-[#111111] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold">Cloova</p>
            <p className="mt-2 text-[12px] text-white/60">Campus Concierge · ALCHE, Mauritius</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-8">
            <p className="text-[12px] text-white/40">© 2025 Cloova. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-4 text-[14px] text-white/60">
              <a href="/contact" className="transition hover:text-white">Contact</a>
              <a href="/login" className="transition hover:text-white">Log in</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
