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

  const prompt = buildPrompt(profile);

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
          max_tokens: 1024,
          temperature: 0.7,
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
    const text =
      data.choices?.[0]?.message?.content ?? "No response generated.";

    return { statusCode: 200, headers, body: JSON.stringify({ advice: text }) };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

function buildPrompt(profile) {
  return `You are an expert college admissions counselor. Analyze this student's profile and give them 4–5 specific, actionable recommendations to improve their college application chances. Be honest, direct, and encouraging. Format your response with clear sections.

STUDENT PROFILE:
- Name: ${profile.name || "Student"}
- GPA (Unweighted): ${profile.gpa ?? "Not provided"}
- GPA (Weighted): ${profile.weightedGpa ?? "Not provided"}
- SAT Score: ${profile.sat ?? "Not provided"}
- ACT Score: ${profile.act ?? "Not provided"}
- AP/IB Courses: ${profile.apCourses ?? 0}
- Extracurricular Activities: ${Array.isArray(profile.activities) ? profile.activities.join(", ") : profile.activities || "None listed"}
- Intended Major: ${profile.intendedMajor || "Undecided"}
- Alternative Majors: ${profile.alternativeMajors || "None"}
- Career Goals: ${profile.careerGoals || "Not specified"}
- Preferred Locations: ${profile.preferredLocations || "No preference"}
- Graduation Year: ${profile.graduationYear || "2026"}

Please provide:
1. **Overall Profile Strength** — A brief honest assessment (2–3 sentences)
2. **Top Recommendations** — 4–5 specific things this student can do RIGHT NOW to improve their application
3. **College List Strategy** — Based on their stats, what tier of schools should they target (safety/match/reach)?
4. **One Key Strength to Highlight** — What should they emphasize in their essays/interviews?

Keep the tone warm, expert, and motivating. Be specific — avoid generic advice.`;
}
