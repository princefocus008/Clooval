/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

const WELCOME_MESSAGE = {
  id: 'welcome',
  type: 'ec',
  text: 'Hi there! Welcome to the ALCHE Election Commission support chat.\n\nYou can ask us about:\n• Nomination requirements\n• Campaign rules\n• Voting day information\n• Results and appeals\n\nLeave your message and we\'ll respond within 24 hours.',
  time: 'Today',
};

export default function SupportWidget() {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isJingling, setIsJingling] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messageContainerRef = useRef(null);
  const textareaRef = useRef(null);

  // Jingle animation on mouse enter
  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsJingling(true);
    setTimeout(() => setIsJingling(false), 500);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Toggle panel open/close
  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  // Handle send message
  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: inputValue.trim(),
      time: 'Just now',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    // Simulate auto-reply after 1200ms
    setTimeout(() => {
      const autoReply = {
        id: `ec-${Date.now()}`,
        type: 'ec',
        text: 'Thanks for reaching out! Your message has been received. A member of the Election Commission will respond within 24 hours at your registered email.',
        time: 'Just now',
      };
      setMessages((prev) => [...prev, autoReply]);
      setIsSending(false);
    }, 1200);
  };

  // Handle Enter key to send
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 310);
    }
  }, [isOpen]);

  return (
    <>
      {/* Floating Button */}
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleToggle}
        className="fixed z-[9999] flex items-center justify-center transition-all duration-300 ease-out"
        style={{
          bottom: '28px',
          right: '28px',
          width: isHovered ? '130px' : '52px',
          height: '52px',
          backgroundColor: '#DFBA73',
          borderRadius: isHovered ? '26px' : '9999px',
          boxShadow: '0 4px 20px rgba(15, 44, 89, 0.25)',
          cursor: 'pointer',
        }}
      >
        <div
          className={isJingling ? 'jingle' : ''}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: isHovered ? '4px' : '0px',
            transformOrigin: 'center',
          }}
        >
          <MessageCircle size={22} color="#0F2C59" />
        </div>

        {/* Support Text (appears on hover) */}
        {isHovered && (
          <span
            style={{
              marginLeft: '8px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F2C59',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              opacity: 1,
              transition: 'opacity 200ms 100ms',
              whiteSpace: 'nowrap',
            }}
          >
            Support
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="slide-up"
          style={{
            position: 'fixed',
            bottom: '92px',
            right: '28px',
            width: 'min(340px, calc(100vw - 32px))',
            height: '480px',
            borderRadius: '0px',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 8px 40px rgba(15, 44, 89, 0.18)',
            border: '1px solid #E2E2E2',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9998,
          }}
        >
          {/* Panel Header */}
          <div
            style={{
              backgroundColor: '#0F2C59',
              height: '64px',
              flexShrink: 0,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Online indicator */}
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '9999px',
                  backgroundColor: '#4ADE80',
                  flexShrink: 0,
                }}
              />
              {/* Header text */}
              <div>
                <div
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'white',
                    lineHeight: '1.2',
                  }}
                >
                  ALCHE Election Commission
                </div>
                <div
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    lineHeight: '1.2',
                  }}
                >
                  Support Team · Online
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.7)',
                transition: 'color 200ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)')}
            >
              <X size={18} />
            </button>
          </div>

          {/* Message Area */}
          <div
            ref={messageContainerRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.type === 'user' ? 'flex-end' : 'flex-start',
                  gap: '4px',
                }}
              >
                {/* Message Bubble */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: msg.type === 'user' ? '0px' : '8px',
                  }}
                >
                  {msg.type === 'ec' && (
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '4px',
                        backgroundColor: '#0F2C59',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'DM Sans, sans-serif',
                          fontSize: '9px',
                          fontWeight: 700,
                          color: '#DFBA73',
                        }}
                      >
                        EC
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      backgroundColor: msg.type === 'user' ? '#0F2C59' : '#F5F5F5',
                      color: msg.type === 'user' ? 'white' : '#333333',
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      padding: '10px 14px',
                      borderRadius: '0px',
                      maxWidth: '240px',
                      borderLeft: msg.type === 'ec' ? '3px solid #DFBA73' : 'none',
                      wordWrap: 'break-word',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>

                {/* Timestamp */}
                <div
                  style={{
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '10px',
                    color: msg.type === 'user' ? 'rgba(255, 255, 255, 0.5)' : '#999999',
                    textAlign: msg.type === 'user' ? 'right' : 'left',
                    marginRight: msg.type === 'user' ? '0px' : 'auto',
                  }}
                >
                  {msg.time}
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div
            style={{
              flexShrink: 0,
              borderTop: '1px solid #E2E2E2',
              padding: '12px 16px',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '10px',
            }}
          >
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              style={{
                flex: 1,
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '13px',
                color: '#333333',
                backgroundColor: '#F5F5F5',
                border: '1px solid #E2E2E2',
                borderRadius: '0px',
                padding: '10px 12px',
                resize: 'none',
                minHeight: '40px',
                maxHeight: '100px',
                outline: 'none',
                transition: 'border-color 200ms',
                fontWeight: 400,
              }}
              onFocus={(e) => (e.target.style.borderColor = '#0F2C59')}
              onBlur={(e) => (e.target.style.borderColor = '#E2E2E2')}
            />

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending}
              style={{
                width: '40px',
                height: '40px',
                flexShrink: 0,
                backgroundColor:
                  !inputValue.trim() || isSending ? '#E2E2E2' : '#DFBA73',
                borderRadius: '0px',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor:
                  !inputValue.trim() || isSending ? 'not-allowed' : 'pointer',
                transition: 'background 200ms',
              }}
              onMouseEnter={(e) => {
                if (inputValue.trim() && !isSending) {
                  e.currentTarget.style.backgroundColor = '#C8A45E';
                }
              }}
              onMouseLeave={(e) => {
                if (inputValue.trim() && !isSending) {
                  e.currentTarget.style.backgroundColor = '#DFBA73';
                }
              }}
            >
              <Send
                size={16}
                color={!inputValue.trim() || isSending ? '#999999' : '#0F2C59'}
              />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
