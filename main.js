import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const info = `
You are an expert AI college and career counselor.

Your task: analyze a student's academic profile, interests, and extracurriculars to recommend suitable college majors and career paths.

Follow these rules and structure your reasoning clearly:

1. Consider:
   - GPA (academic strength)
   - SAT/ACT performance areas (e.g., higher math vs. reading)
   - Classes taken (especially AP or advanced)
   - Extracurricular activities or leadership

2. Prioritize career paths that align with both interests and measurable strengths (grades, classes, test scores).

3. Each recommendation should include:
   - Major name (e.g., "Computer Science")
   - Description (1–2 sentences on what the field involves)
   - Why it fits the student (based on their data)
   - Related careers (3–5 examples)

4. You may recommend multiple paths if the student fits in several (e.g., STEM + Business crossover).

5. Base your suggestions on real-world college majors and career families such as:
   - STEM (Computer Science, Engineering, Math, Physics, Data Science)
   - Business (Finance, Marketing, Entrepreneurship, Accounting)
   - Medicine & Life Sciences (Biology, Neuroscience, Nursing, Public Health)
   - Law, Government, & Social Sciences (Political Science, Psychology, Sociology)
   - Arts, Design, & Media (Graphic Design, Journalism, Film, UX Design)
   - Education (Teaching, Counseling, Educational Leadership)
   - Humanities (English, History, Philosophy, Linguistics)
   - Emerging Fields (AI, Cybersecurity, Renewable Energy, Robotics)

6. Be realistic: suggest majors that match the student’s stats and interests — not overly selective or mismatched fields.
`;
const info1 = `
You are an expert AI college counselor.

Use the following background data to help recommend majors:

STEM:
- Computer Science: avg GPA 3.6, avg SAT 1400
- Mechanical Engineering: avg GPA 3.7, avg SAT 1420
- Data Science: avg GPA 3.65, avg SAT 1380

Business:
- Finance: avg GPA 3.4, avg SAT 1320
- Entrepreneurship: avg GPA 3.3, avg SAT 1300

Arts & Humanities:
- Graphic Design: avg GPA 3.2, avg SAT 1250
- Psychology: avg GPA 3.5, avg SAT 1300

Use this data along with the student profile (GPA, SAT, classes, interests) to recommend realistic and relevant majors.
Always explain *why* each major is a good fit based on the student’s stats and experiences.
Output in this format:
1. Major
   Description
   Why it fits
   Related Careers
   Example Colleges
`;

async function main() {
    const student = {
        name: "Suraj Raju",
        gpa: 3.83,
        sat: 1400,
        classesTaken: [
        "AP Computer Science A",
        "AP European History",
        "AP Statistics"
        ],
        extracurriculars: [
        "Interned for Davis Tekton LLC",
        "Grew stock portfolio 124%"
        ],
       interests: ["Investing", "Teaching", "Entrepreneurship"]
    };
  const prompt = `Student Profile:
        ${JSON.stringify(student, null, 2)}

        Task:
        Analyze this student's academic strengths, interests, and extracurriculars.
        Recommend 3 to 5 college majors or career paths that best fit the student's strengths and goals. Try to be concise

        Format your output as:

        1. Major:
        Description:
        Why it fits:
        Related Careers:
        Example Colleges:`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro", systemInstruction: info1 });

  const result = await model.generateContent(prompt);

  console.log(result.response.text());
}

main();
