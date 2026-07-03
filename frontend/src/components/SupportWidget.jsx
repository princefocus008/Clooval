/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, X, CheckCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/store";

const CATEGORIES = ["Request help", "Tech issue", "Other"];
const MAX_MESSAGE_LENGTH = 500;

export default function SupportWidget() {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [bottomOffset, setBottomOffset] = useState(24);

  const closeTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      resetForm();
    }, 5000);

    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
      }
    };
  }, [isSuccess]);

  useEffect(() => {
    const updateOffset = () => {
      if (window.innerWidth <= 640) {
        setBottomOffset(88); // avoid mobile bottom nav
      } else {
        setBottomOffset(24);
      }
    };
    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => window.removeEventListener("resize", updateOffset);
  }, []);

  const resetForm = () => {
    setCategory("");
    setMessage("");
    setError("");
    setIsSubmitting(false);
    setIsSuccess(false);
    setCountdown(5);
  };

  const canSubmit = useMemo(() => {
    return category && message.trim().length >= 10 && !isSubmitting;
  }, [category, message, isSubmitting]);

  const handleSend = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const resp = await api.post("/support", {
        category,
        message: message.trim(),
      });
      setIsSubmitting(false);
      setIsSuccess(true);
      // play a subtle notification sound on success (file fallback -> WebAudio)
      (async () => {
        try {
          const audio = new Audio('/assets/notification-ring.mp3');
          await audio.play();
        } catch (e) {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = 880;
            g.gain.value = 0.02;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            setTimeout(() => { o.stop(); ctx.close(); }, 200);
          } catch (e2) {
            // ignore audio errors
          }
        }
      })();
    } catch (err) {
      setIsSubmitting(false);
      const serverMsg = err?.response?.data?.message || err?.message;
      setError(serverMsg || "Something went wrong. Please try again.");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open support widget"
        style={{
          position: "fixed",
          bottom: bottomOffset,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: 9999,
          backgroundColor: "#111111",
          boxShadow: "0 4px 20px rgba(0,0,0,0.20)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          transition: "all 160ms ease",
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.backgroundColor = "#333333";
          event.currentTarget.style.transform = "scale(1.04)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.backgroundColor = "#111111";
          event.currentTarget.style.transform = "scale(1)";
        }}
      >
        <HelpCircle size={22} color="#FFFFFF" />
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            width: "min(340px, calc(100vw - 32px))",
            maxHeight: 520,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E5E3",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            overflow: "hidden",
            zIndex: 9999,
            animation: "support-panel-open 200ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <div
            style={{
              height: 56,
              backgroundColor: "#111111",
              borderRadius: "12px 12px 0 0",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#FFFFFF",
                }}
              >
                Get help
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                We'll respond shortly
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
              aria-label="Close support panel"
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                backgroundColor: "rgba(255,255,255,0.12)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = "rgba(255,255,255,0.20)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = "rgba(255,255,255,0.12)";
              }}
            >
              <X size={16} color="#FFFFFF" />
            </button>
          </div>

          {isSuccess ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <CheckCircle size={36} color="#111111" />
              <h2
                style={{
                  margin: "12px 0 0",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#111111",
                }}
              >
                Message sent
              </h2>
              <p
                style={{
                  margin: "16px 0 0",
                  fontSize: 13,
                  color: "#555555",
                  lineHeight: 1.6,
                }}
              >
                We'll get back to you at {user.email}. Usually within a few hours.
              </p>
              <button
                type="button"
                onClick={resetForm}
                style={{
                  marginTop: 24,
                  border: "none",
                  background: "none",
                  color: "#999999",
                  fontSize: 13,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Send another message
              </button>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: "#999999",
                }}
              >
                Closing in {countdown} second{countdown === 1 ? "" : "s"}...
              </p>
            </div>
          ) : (
            <div style={{ padding: "20px 16px", overflowY: "auto" }}>
              <div
                style={{
                  backgroundColor: "#F7F7F5",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    color: "#999999",
                    textTransform: "uppercase",
                  }}
                >
                  Sending as
                </p>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#111111",
                  }}
                >
                  {user.name}
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "#999999",
                    lineHeight: 1.4,
                  }}
                >
                  {user.email}
                </p>
              </div>

              <div>
                <label
                  htmlFor="support-category"
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    color: "#999999",
                    textTransform: "uppercase",
                  }}
                >
                  What do you need help with?
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {CATEGORIES.map((option) => {
                    const selected = category === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setCategory(option)}
                        style={{
                          height: 32,
                          padding: "0 14px",
                          borderRadius: 6,
                          border: "1px solid #E5E5E3",
                          backgroundColor: selected ? "#111111" : "#FFFFFF",
                          color: selected ? "#FFFFFF" : "#555555",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "all 150ms ease",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label
                  htmlFor="support-message"
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    color: "#999999",
                    textTransform: "uppercase",
                  }}
                >
                  Your message
                </label>
                <textarea
                  id="support-message"
                  value={message}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue.length <= MAX_MESSAGE_LENGTH) {
                      setMessage(nextValue);
                    }
                  }}
                  placeholder="Describe what you need help with..."
                  style={{
                    width: "100%",
                    minHeight: 96,
                    border: "1px solid #E5E5E3",
                    borderRadius: 8,
                    padding: "10px 12px",
                    marginTop: 8,
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    color: "#111111",
                    resize: "none",
                    outline: "none",
                  }}
                  onFocus={(event) => {
                    event.currentTarget.style.border = "2px solid #111111";
                  }}
                  onBlur={(event) => {
                    event.currentTarget.style.border = "1px solid #E5E5E3";
                  }}
                />
                <div
                  style={{
                    marginTop: 8,
                    textAlign: "right",
                    fontSize: 11,
                    color: "#999999",
                  }}
                >
                  {message.length} / {MAX_MESSAGE_LENGTH}
                </div>
              </div>

              {error && (
                <p
                  style={{
                    marginTop: 12,
                    color: "#555555",
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={!canSubmit}
                style={{
                  width: "100%",
                  height: 40,
                  marginTop: 12,
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: !canSubmit ? "#E5E5E3" : "#111111",
                  color: !canSubmit ? "#999999" : "#FFFFFF",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: !canSubmit ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSubmitting ? (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid #FFFFFF",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "support-spinner 0.7s linear infinite",
                      display: "inline-block",
                    }}
                  />
                ) : (
                  "Send message"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes support-spinner {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes support-panel-open {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
