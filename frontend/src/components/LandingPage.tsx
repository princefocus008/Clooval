/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import Logo from "./Logo";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Logo />
            <button
              onClick={() => navigate("/login")}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Student Service Concierge
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Get professional repairs and services for your devices. Fast, reliable, and affordable solutions at your fingertips.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="px-8 py-3 rounded-lg bg-blue-600 text-white font-medium text-lg hover:bg-blue-700 transition"
          >
            Get Started
          </button>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="text-center">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Fast Service</h3>
            <p className="text-gray-600">Quick turnaround times for all repairs and services</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Expert Technicians</h3>
            <p className="text-gray-600">Professional and vetted service providers</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Affordable Pricing</h3>
            <p className="text-gray-600">Competitive rates with transparent pricing</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-600">
            © 2024 Cloova. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
