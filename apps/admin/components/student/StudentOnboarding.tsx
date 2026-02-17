"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTerminology } from "@/contexts/TerminologyContext";
import { Sparkles, Target, MessageCircle, Rocket } from "lucide-react";

interface GoalData {
  id: string;
  name: string;
  type: string;
  progress: number;
  description: string | null;
}

interface StudentOnboardingProps {
  goals: GoalData[];
  teacherName: string | null;
  institutionName: string | null;
  institutionLogo: string | null;
  welcomeMessage: string | null;
  domain: string | null;
  onComplete: () => void;
}

export default function StudentOnboarding({
  goals,
  teacherName,
  institutionName,
  institutionLogo,
  welcomeMessage,
  domain,
  onComplete,
}: StudentOnboardingProps) {
  const router = useRouter();
  const { lower } = useTerminology();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [confirmedGoals, setConfirmedGoals] = useState<Set<string>>(
    new Set(goals.map((g) => g.id))
  );
  const [customGoal, setCustomGoal] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);

  const handleAddGoal = async () => {
    if (!customGoal.trim()) return;
    setAddingGoal(true);
    try {
      const res = await fetch("/api/student/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: customGoal.trim(), type: "LEARN" }),
      });
      const data = await res.json();
      if (data.ok) {
        goals.push(data.goal);
        setConfirmedGoals((prev) => new Set([...prev, data.goal.id]));
        setCustomGoal("");
      }
    } finally {
      setAddingGoal(false);
    }
  };

  const handleFinish = () => {
    localStorage.setItem("onboarding-seen", "true");
    onComplete();
    router.push("/x/sim");
  };

  const totalSteps = 4;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px" }}>
      {/* Step indicators */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background:
                s <= step
                  ? "var(--button-primary-bg)"
                  : "var(--border-default)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* Step 1: Welcome */}
      {step === 1 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}
        >
          {institutionLogo && (
            <img
              src={institutionLogo}
              alt={institutionName ?? ""}
              style={{
                width: 64,
                height: 64,
                objectFit: "contain",
                marginBottom: 16,
                borderRadius: 8,
              }}
            />
          )}
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            Welcome{institutionName ? ` to ${institutionName}` : ""}!
          </h1>
          {teacherName && (
            <p
              style={{
                fontSize: 15,
                color: "var(--text-secondary)",
                marginBottom: 8,
              }}
            >
              Your {lower("instructor")}: {teacherName}
            </p>
          )}
          {domain && (
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginBottom: 16,
              }}
            >
              {domain}
            </p>
          )}
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {welcomeMessage ??
              "You're about to start a personalised learning journey. Let's get you set up in just a few steps."}
          </p>
          <button
            onClick={() => setStep(2)}
            style={{
              width: "100%",
              padding: "12px 24px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Get Started
          </button>
        </div>
      )}

      {/* Step 2: Your Goals */}
      {step === 2 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Target size={20} style={{ color: "var(--accent-primary)" }} />
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Your Goals
            </h2>
          </div>

          {goals.length > 0 ? (
            <>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-muted)",
                  marginBottom: 16,
                }}
              >
                These goals have been set for your learning journey. You can confirm or adjust them.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {goals.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => {
                      setConfirmedGoals((prev) => {
                        const next = new Set(prev);
                        if (next.has(goal.id)) next.delete(goal.id);
                        else next.add(goal.id);
                        return next;
                      });
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      border: `1px solid ${
                        confirmedGoals.has(goal.id)
                          ? "var(--accent-primary)"
                          : "var(--border-default)"
                      }`,
                      borderRadius: 8,
                      background: confirmedGoals.has(goal.id)
                        ? "color-mix(in srgb, var(--accent-primary) 8%, transparent)"
                        : "var(--surface-secondary)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.2s",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: `2px solid ${
                          confirmedGoals.has(goal.id)
                            ? "var(--accent-primary)"
                            : "var(--border-default)"
                        }`,
                        background: confirmedGoals.has(goal.id)
                          ? "var(--accent-primary)"
                          : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {confirmedGoals.has(goal.id) && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2.5 6L5 8.5L9.5 4"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--text-primary)",
                        }}
                      >
                        {goal.name}
                      </div>
                      {goal.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-muted)",
                            marginTop: 2,
                          }}
                        >
                          {goal.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p
              style={{
                fontSize: 14,
                color: "var(--text-muted)",
                marginBottom: 16,
              }}
            >
              What would you like to learn or achieve? Add a goal below.
            </p>
          )}

          {/* Add custom goal */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input
              type="text"
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGoal()}
              placeholder="Add a personal goal..."
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                background: "var(--surface-secondary)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            <button
              onClick={handleAddGoal}
              disabled={!customGoal.trim() || addingGoal}
              style={{
                padding: "8px 16px",
                background:
                  !customGoal.trim() || addingGoal
                    ? "var(--border-default)"
                    : "var(--accent-primary)",
                color:
                  !customGoal.trim() || addingGoal
                    ? "var(--text-muted)"
                    : "white",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  !customGoal.trim() || addingGoal ? "not-allowed" : "pointer",
              }}
            >
              {addingGoal ? "..." : "Add"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: "10px 20px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              style={{
                flex: 2,
                padding: "10px 20px",
                background: "var(--button-primary-bg)",
                color: "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: How It Works */}
      {step === 3 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <MessageCircle size={20} style={{ color: "var(--accent-primary)" }} />
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              How It Works
            </h2>
          </div>

          <p
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              marginBottom: 20,
              lineHeight: 1.6,
            }}
          >
            You'll have voice conversations with an AI tutor that adapts to you.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            {[
              {
                icon: Sparkles,
                title: "Personalised to you",
                desc: "The AI learns how you think and adapts its teaching style to match.",
              },
              {
                icon: Target,
                title: "Goal-driven",
                desc: "Each conversation works toward your learning goals and tracks progress.",
              },
              {
                icon: MessageCircle,
                title: "Natural conversation",
                desc: "Just talk naturally. The AI will guide the learning through dialogue.",
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 12,
                  background: "var(--surface-secondary)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background:
                      "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <item.icon
                    size={18}
                    style={{ color: "var(--accent-primary)" }}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 2,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-muted)",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep(2)}
              style={{
                flex: 1,
                padding: "10px 20px",
                background: "var(--surface-secondary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              style={{
                flex: 2,
                padding: "10px 20px",
                background: "var(--button-primary-bg)",
                color: "var(--button-primary-text)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Ready */}
      {step === 4 && (
        <div
          style={{
            background: "var(--surface-primary)",
            border: "1px solid var(--border-default)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background:
                "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Rocket size={32} style={{ color: "var(--accent-primary)" }} />
          </div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: 8,
            }}
          >
            You're All Set!
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            Start your first conversation and your AI tutor will take it from there.
          </p>

          <button
            onClick={handleFinish}
            style={{
              width: "100%",
              padding: "14px 24px",
              background: "var(--button-primary-bg)",
              color: "var(--button-primary-text)",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Start Your First Conversation
          </button>
          <button
            onClick={() => {
              localStorage.setItem("onboarding-seen", "true");
              onComplete();
            }}
            style={{
              width: "100%",
              padding: "10px 24px",
              background: "transparent",
              color: "var(--text-muted)",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Skip for now
          </button>
        </div>
      )}

      {/* Step counter */}
      <div
        style={{
          textAlign: "center",
          marginTop: 16,
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        Step {step} of {totalSteps}
      </div>
    </div>
  );
}
