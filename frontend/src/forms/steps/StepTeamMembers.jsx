import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { teamMemberSchema } from "../../lib/schemas.js";
import { stepSlide } from "../../animations/motionVariants.js";

const fieldClass =
  "w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none";

export default function StepTeamMembers({ event, defaultValues, onNext, onBack }) {
  const minMembers = Math.max(0, event.min_team_size - 1); // beyond the leader
  const maxMembers = Math.max(0, event.max_team_size - 1);
  const isTeamEvent = event.max_team_size > 1;

  const schema = z.object({
    teamName: isTeamEvent ? z.string().min(1, "Team name is required") : z.string().optional(),
    members: z.array(teamMemberSchema),
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      teamName: defaultValues?.teamName ?? "",
      members:
        defaultValues?.members ??
        Array.from({ length: minMembers }, () => ({
          fullName: "",
          rollNumber: "",
          college: "",
          course: "",
          branch: "",
          year: "",
          mobile: "",
          email: "",
        })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "members" });
  const [countError, setCountError] = useState(null);

  function submit(data) {
    if (data.members.length < minMembers || data.members.length > maxMembers) {
      setCountError(`Team must have ${minMembers + 1}-${maxMembers + 1} members (including you).`);
      return;
    }
    setCountError(null);
    onNext(data);
  }

  if (!isTeamEvent) {
    return (
      <motion.div variants={stepSlide} initial="enter" animate="center" exit="exit">
        <h2 className="text-xl font-semibold">Team members</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {event.name} is an individual event — no team members to add.
        </p>
        <div className="mt-6 flex justify-between">
          <button type="button" onClick={onBack} className="rounded-full border border-border px-6 py-2 text-sm hover:border-primary">
            Back
          </button>
          <button
            type="button"
            onClick={() => onNext({ teamName: "", members: [] })}
            className="rounded-full bg-primary px-6 py-2 font-semibold text-background hover:bg-primary-light"
          >
            Next
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.form variants={stepSlide} initial="enter" animate="center" exit="exit" onSubmit={handleSubmit(submit)}>
      <h2 className="text-xl font-semibold">Team members</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Team size for {event.name}: {event.min_team_size}-{event.max_team_size} (including you).
      </p>

      <div className="mt-4">
        <label className="mb-1 block text-sm text-foreground-muted">Team name</label>
        <input className={fieldClass} {...register("teamName")} />
        {errors.teamName && <p className="mt-1 text-xs text-red-400">{errors.teamName.message}</p>}
      </div>

      <div className="mt-4 space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Member {index + 2}</span>
              {fields.length > minMembers && (
                <button type="button" onClick={() => remove(index)} className="text-xs text-red-400 hover:underline">
                  Remove
                </button>
              )}
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                  <label className="mb-1 block text-xs text-foreground-muted">{label}</label>
                  {name === "year" ? (
                    <select className={fieldClass} defaultValue="" {...register(`members.${index}.${name}`)}>
                      <option value="" disabled>
                        Select year
                      </option>
                      <option value="1st year">1st year</option>
                      <option value="2nd year">2nd year</option>
                      <option value="3rd year">3rd year</option>
                    </select>
                  ) : (
                    <input className={fieldClass} {...register(`members.${index}.${name}`)} />
                  )}
                  {errors.members?.[index]?.[name] && (
                    <p className="mt-1 text-xs text-red-400">{errors.members[index][name].message}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {fields.length < maxMembers && (
        <button
          type="button"
          onClick={() =>
            append({ fullName: "", rollNumber: "", college: "", course: "", branch: "", year: "", mobile: "", email: "" })
          }
          className="mt-4 rounded-full border border-border px-4 py-2 text-sm hover:border-primary"
        >
          + Add member
        </button>
      )}

      {countError && <p className="mt-3 text-sm text-red-400">{countError}</p>}

      <div className="mt-6 flex justify-between">
        <button type="button" onClick={onBack} className="rounded-full border border-border px-6 py-2 text-sm hover:border-primary">
          Back
        </button>
        <button type="submit" className="rounded-full bg-primary px-6 py-2 font-semibold text-background hover:bg-primary-light">
          Next
        </button>
      </div>
    </motion.form>
  );
}
