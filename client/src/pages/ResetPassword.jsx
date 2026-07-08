import React, { useContext, useState } from "react";
import { assets } from "../assets/assets";
import { useNavigate } from "react-router-dom";
import AppContent from "../context/AppContent";
import axios from "axios";
import { toast } from "react-toastify";

const ResetPassword = () => {
  const { backendUrl } = useContext(AppContent);
  axios.defaults.withCredentials = true;

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [isOtpSubmited, setIsOtpSubmited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inputRefs = React.useRef([]);

  const handleInput = (e, index) => {
    if (e.target.value.length > 0 && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && e.target.value === "" && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData("text");
    const pasteArray = paste.split("");
    pasteArray.forEach((char, index) => {
      if (inputRefs.current[index]) {
        inputRefs.current[index].value = char;
      }
    });
  };

  const onSubmitEmail = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data } = await axios.post(
        backendUrl + "/api/auth/send-reset-otp",
        { email },
      );
      data.success ? toast.success(data.message) : toast.error(data.message);
      data.success && setIsEmailSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send email");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitOTP = async (e) => {
    e.preventDefault();
    const otpString = inputRefs.current.map((el) => el.value).join("");

    if (otpString.length < 6) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }

    setOtp(otpString); // Save the OTP
    setIsOtpSubmited(true); // Show the next form
  };

  const onSubmitNewPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data } = await axios.post(
        backendUrl + "/api/auth/reset-password",
        { email, otp, newPassword },
      );

      if (data.success) {
        toast.success(data.message);
        navigate("/login");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-linear-to-br from-blue-200 to-purple-400 overflow-hidden px-4 sm:px-6">
      {/* Logo */}
      <img
        onClick={() => navigate("/")}
        src={assets.logo}
        alt="Logo"
        className="absolute left-5 sm:left-20 top-5 w-28 sm:w-32 cursor-pointer transition-all duration-300 hover:scale-105 hover:opacity-90 z-20"
      />

      {/* Authentication Card */}
      <div className="relative w-full max-w-md bg-slate-900 backdrop-blur-2xl border border-slate-700/40 rounded-2xl shadow-2xl shadow-black/20 p-8 sm:p-10 z-10 transition-all duration-300">
        {/* Step 1: Email Form */}
        {!isEmailSent && (
          <form onSubmit={onSubmitEmail} className="space-y-5">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
                Reset Password
              </h1>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Enter your registered email address
              </p>
            </div>

            <div>
              <label
                htmlFor="reset-email"
                className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1"
              >
                Email Address
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <img
                    src={assets.mail_icon}
                    alt=""
                    className="w-5 h-5 opacity-70"
                  />
                </div>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/40 border border-slate-600/40 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 focus:border-indigo-400/60 focus:bg-slate-800/60 focus:ring-2 focus:ring-indigo-400/20 hover:border-slate-500/60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl cursor-pointer bg-linear-to-r from-indigo-500 to-indigo-900 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Sending...</span>
                </>
              ) : (
                "Send Reset Code"
              )}
            </button>
          </form>
        )}

        {/* Step 2: OTP Form */}
        {!isOtpSubmited && isEmailSent && (
          <form onSubmit={onSubmitOTP} className="space-y-5">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
                Verify OTP
              </h1>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 ml-1 text-center">
                Verification Code
              </label>
              <div
                className="flex justify-center gap-3 mb-8"
                onPaste={handlePaste}
              >
                {Array(6)
                  .fill(0)
                  .map((_, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength={1}
                      required
                      ref={(el) => (inputRefs.current[index] = el)}
                      onInput={(e) => handleInput(e, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="
                                        w-12
                                        h-12
                                        sm:w-14
                                        sm:h-14
                                        text-center
                                        text-xl
                                        font-semibold
                                        bg-slate-800/40
                                        border
                                        border-slate-600/40
                                        rounded-xl
                                        text-white
                                        outline-none
                                        transition-all
                                        duration-200
                                        focus:border-indigo-400/60
                                        focus:ring-2
                                        focus:ring-indigo-400/20
                                        hover:border-slate-500/60
                                        "
                    />
                  ))}
              </div>
            </div>

            <button
              type="submit"
              onSubmit={onSubmitOTP}
              className="w-full py-3 px-4  cursor-pointer rounded-xl bg-linear-to-r from-indigo-500 to-indigo-900 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
            >
              Verify Code
            </button>
          </form>
        )}

        {/* Step 3: New Password Form */}
        {isOtpSubmited && isEmailSent && (
          <form onSubmit={onSubmitNewPassword} className="space-y-5">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
                New Password
              </h1>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Enter your new password below
              </p>
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1"
              >
                New Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <img
                    src={assets.lock_icon}
                    alt=""
                    className="w-5 h-5 opacity-70"
                  />
                </div>
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-12 py-3 bg-slate-800/40 border border-slate-600/40 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 focus:border-indigo-400/60 focus:bg-slate-800/60 focus:ring-2 focus:ring-indigo-400/20 hover:border-slate-500/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-indigo-400 transition-colors duration-200 outline-none focus:text-indigo-400"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 cursor-pointer rounded-xl bg-linear-to-r from-indigo-500 to-indigo-900 text-white font-semibold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Resetting...</span>
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
