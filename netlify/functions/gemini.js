exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "Gemini API key not configured. Add GEMINI_API_KEY to Netlify environment variables.",
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

  // Build a rich prompt from the student's profile
  const prompt = buildPrompt(profile);

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error("Gemini API error body:", errText); // add this
        return {
          statusCode: geminiRes.status,
          headers,
          body: JSON.stringify({
            error: `Gemini API error: ${geminiRes.status} — ${errText}`,
          }),
        };
      }
    }

    const data = await geminiRes.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "No response generated.";

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
