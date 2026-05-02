import { useState } from "react";
import { Input } from "@/components/ui/input";
function OtpInput({ length = 6, onComplete }) {
  const [otp, setOtp] = useState(new Array(length).fill(""));
  const handleChange = (index, event) => {
    const value = event.target.value;
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < length - 1) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
    const otpString = newOtp.join("");
    if (otpString.length === length && !otpString.includes("")) {
      onComplete(otpString);
    }
  };
  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };
  const handlePaste = (event) => {
    event.preventDefault();
    const pastedData = event.clipboardData.getData("text").slice(0, length);
    if (isNaN(Number(pastedData))) return;
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    const lastIndex = Math.min(pastedData.length, length) - 1;
    const lastInput = document.getElementById(`otp-input-${lastIndex}`);
    lastInput?.focus();
    const otpString = newOtp.join("");
    if (otpString.length === length && !otpString.includes("")) {
      onComplete(otpString);
    }
  };
  return <div className="flex gap-2 justify-center">
      {otp.map((digit, index) => <Input
    key={index}
    id={`otp-input-${index}`}
    type="text"
    inputMode="numeric"
    maxLength={1}
    value={digit}
    onChange={(e) => handleChange(index, e)}
    onKeyDown={(e) => handleKeyDown(index, e)}
    onPaste={handlePaste}
    className="w-12 h-14 text-center text-2xl font-bold"
  />)}
    </div>;
}
export {
  OtpInput
};
