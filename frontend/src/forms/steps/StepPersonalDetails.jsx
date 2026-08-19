import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { personalDetailsSchema } from "../../lib/schemas.js";
import { stepSlide } from "../../animations/motionVariants.js";

const fieldClass =
  "w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

export default function StepPersonalDetails({ defaultValues, onNext, onBack }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(personalDetailsSchema), defaultValues });

  return (
    <motion.form
      variants={stepSlide}
      initial="enter"
      animate="center"
      exit="exit"
      onSubmit={handleSubmit(onNext)}
      className="grid gap-4 sm:grid-cols-2"
    >
      <h2 className="col-span-full text-xl font-semibold">Your details (Participant 1 / Team Leader)</h2>

      {[
        ["fullName", "Full name"],
        ["rollNumber", "Roll number"],
        ["college", "College"],
        ["course", "Course"],
        ["branch", "Branch"],
        ["year", "Year"],
        ["mobile", "Mobile number"],
        ["email", "Email"],
      ].map(([name, label]) => (
        <div key={name}>
          <label className="mb-1 block text-sm text-foreground-muted">{label}</label>
          {name === "year" ? (
            <select className={fieldClass} defaultValue="" {...register(name)}>
              <option value="" disabled>
                Select year
              </option>
              <option value="1st year">1st year</option>
              <option value="2nd year">2nd year</option>
              <option value="3rd year">3rd year</option>
            </select>
          ) : (
            <input className={fieldClass} {...register(name)} />
          )}
          {errors[name] && <p className="mt-1 text-xs text-red-400">{errors[name].message}</p>}
        </div>
      ))}

      <div className="col-span-full mt-2 flex justify-between">
        {onBack && (
          <button type="button" onClick={onBack} className="rounded-full border border-border px-6 py-2 text-sm hover:border-primary">
            Back
          </button>
        )}
        <button type="submit" className="ml-auto rounded-full bg-primary px-6 py-2 font-semibold text-background hover:bg-primary-light">
          Next
        </button>
      </div>
    </motion.form>
  );
}
