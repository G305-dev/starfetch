"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useId, useState } from "react";

type BasicInfoErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function IndividualRegistrationForm() {
  const router = useRouter();
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<BasicInfoErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const nextErrors: BasicInfoErrors = {};

    if (!firstName) nextErrors.firstName = "Enter your first name.";
    if (!lastName) nextErrors.lastName = "Enter your last name.";
    if (!email) {
      nextErrors.email = "Enter your email address.";
    } else if (!emailPattern.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) nextErrors.password = "Enter a password.";
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (password && password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length === 0) {
      router.push("/register/individual/verify-email");
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div className="text-center">
        <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Individual account</p>
        <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Tell us about yourself</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-star-muted">
          Provide your basic information to continue opening an Individual Account.
        </p>

        <div className="mx-auto mt-6 w-full max-w-[210px]" aria-label="Step 2 of 4">
          <p className="text-xs font-bold text-star-700">Step 2 of 4</p>
          <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2, 3].map((step) => (
              <span key={step} className={`h-1.5 rounded-full ${step <= 1 ? "w-8 bg-star-lime" : "w-1.5 bg-star-200"}`} />
            ))}
          </div>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} className="mt-9 rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldError error={errors.firstName} id={`${firstNameId}-error`}>
            <label htmlFor={firstNameId} className="mb-2 block text-sm font-bold text-star-900">First name</label>
            <input
              id={firstNameId}
              name="firstName"
              type="text"
              autoComplete="given-name"
              placeholder="Your first name"
              aria-invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? `${firstNameId}-error` : undefined}
              className={inputClassName(Boolean(errors.firstName))}
            />
          </FieldError>

          <FieldError error={errors.lastName} id={`${lastNameId}-error`}>
            <label htmlFor={lastNameId} className="mb-2 block text-sm font-bold text-star-900">Last name</label>
            <input
              id={lastNameId}
              name="lastName"
              type="text"
              autoComplete="family-name"
              placeholder="Your last name"
              aria-invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? `${lastNameId}-error` : undefined}
              className={inputClassName(Boolean(errors.lastName))}
            />
          </FieldError>
        </div>

        <div className="mt-5">
          <FieldError error={errors.email} id={`${emailId}-error`}>
            <label htmlFor={emailId} className="mb-2 block text-sm font-bold text-star-900">Email address</label>
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              className={inputClassName(Boolean(errors.email))}
            />
          </FieldError>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <PasswordField
            id={passwordId}
            label="Password"
            name="password"
            placeholder="Create a password"
            error={errors.password}
            showPassword={showPassword}
            onToggle={() => setShowPassword((current) => !current)}
          />
          <PasswordField
            id={confirmPasswordId}
            label="Confirm password"
            name="confirmPassword"
            placeholder="Confirm your password"
            error={errors.confirmPassword}
            showPassword={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((current) => !current)}
          />
        </div>

        <button
          type="submit"
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0"
        >
          Continue
        </button>
      </form>
    </section>
  );
}

function inputClassName(hasError: boolean) {
  return `h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${hasError ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`;
}

function FieldError({ children, error, id }: { children: ReactNode; error?: string; id: string }) {
  return (
    <div>
      {children}
      {error ? <p id={id} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  name: string;
  placeholder: string;
  error?: string;
  showPassword: boolean;
  onToggle: () => void;
};

function PasswordField({ id, label, name, placeholder, error, showPassword, onToggle }: PasswordFieldProps) {
  return (
    <FieldError error={error} id={`${id}-error`}>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputClassName(Boolean(error))} pr-12`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-star-700 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700"
          aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </FieldError>
  );
}
