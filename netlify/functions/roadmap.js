exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "Groq API key not configured. Add GROQ_API_KEY to Netlify environment variables.",
      }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { profile } = body;
  if (!profile) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing profile data" }),
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt(profile, today);

  try {
    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2048,
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("Groq API error:", errText);
      return {
        statusCode: groqRes.status,
        headers,
        body: JSON.stringify({
          error: `Groq API error: ${groqRes.status} — ${errText}`,
        }),
      };
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const roadmap = parseRoadmapJson(text);

    if (!roadmap.phases?.length) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Could not parse roadmap from AI response." }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ roadmap }),
    };
  } catch (err) {
    console.error("Roadmap function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

function buildPrompt(profile, today) {
  const gradYear = profile.graduationYear || "2026";
  const appSeason = `${Number(gradYear) - 1}–${gradYear}`;

  return `You are an expert college admissions counselor. Today is ${today}.

Create a personalized college application roadmap as a JSON object for this student. Infer where they are in their journey from their profile (graduation year, test scores, activities, goals) and today's date. Only include phases from the current month forward through college enrollment — do not list months that are already fully in the past unless they contain still-relevant unfinished tasks.

STUDENT PROFILE:
- Name: ${profile.name || "Student"}
- Graduation Year: ${gradYear}
- Application Season: ${appSeason}
- High School: ${profile.highSchool || "Not provided"}
- Home State: ${profile.homeState || "Not provided"}
- GPA (Unweighted): ${profile.gpa ?? "Not provided"}
- GPA (Weighted): ${profile.weightedGpa ?? "Not provided"}
- SAT Score: ${profile.sat ?? "Not provided"}
- ACT Score: ${profile.act ?? "Not provided"}
- AP/IB Courses: ${profile.apCourses ?? 0}
- Activities: ${Array.isArray(profile.activities) ? profile.activities.join(", ") : profile.activities || "None listed"}
- Intended Major: ${profile.intendedMajor || "Undecided"}
- Career Goals: ${profile.careerGoals || "Not specified"}
- Preferred Locations: ${profile.preferredLocations || "No preference"}
- Financial Aid Need: ${profile.financialNeed || "Not specified"}

Return ONLY valid JSON with this exact shape (no markdown):
{
  "timelineLabel": "Academic Year ${Number(gradYear) - 1}-${gradYear}",
  "phases": [
    {
      "title": "June 2026",
      "status": "active",
      "items": [
        { "id": "jun-2026-1", "text": "Specific actionable task tailored to this student" }
      ]
    }
  ]
}

Rules:
- Include 4–8 phases, each covering a month or logical range (e.g. "July – August 2026").
- Each phase has 3–5 specific, actionable items (not generic filler).
- status must be exactly one of: "completed", "active", "upcoming". Mark exactly ONE phase as "active" (the current focus). Earlier relevant phases can be "completed" only if work is likely done; future phases are "upcoming".
- Each item needs a unique stable "id" (lowercase, hyphenated, e.g. "oct-2025-essays").
- Tailor tasks to gaps in their profile (missing tests, no activities listed, undecided major, etc.).`;
}

function parseRoadmapJson(text) {
  try {
    return normalizeRoadmap(JSON.parse(text));
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return normalizeRoadmap(JSON.parse(match[0]));
      } catch {
        return { phases: [] };
      }
    }
    return { phases: [] };
  }
}

function normalizeRoadmap(raw) {
  const validStatus = new Set(["completed", "active", "upcoming"]);
  const phases = (raw.phases || [])
    .map((phase, phaseIndex) => ({
      title: String(phase.title || `Phase ${phaseIndex + 1}`).trim(),
      status: validStatus.has(phase.status) ? phase.status : "upcoming",
      items: (phase.items || [])
        .map((item, itemIndex) => ({
          id: String(item.id || `phase-${phaseIndex}-item-${itemIndex}`).trim(),
          text: String(item.text || "").trim(),
        }))
        .filter((item) => item.text),
    }))
    .filter((phase) => phase.items.length > 0);

  return {
    timelineLabel: String(raw.timelineLabel || "Your Application Timeline").trim(),
    phases,
  };
}
