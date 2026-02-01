import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();




const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

// Helper function to wait for a specified duration
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function main(resume, retries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${resume} Analyze the provided resume and generate a single-file modern portfolio website.

Requirements:

Output only raw HTML, CSS (Tailwind via browser CDN), and JavaScript in one file

Use Tailwind only from
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

Use Font Awesome CDN for icons

Use Unsplash images only for avatar or hero visuals (no random or broken URLs)

Do not add comments at the start or end of the file

No markdown, no explanations

Design & Structure:

Clean, modern, professional UI

Responsive layout

Working sticky navbar with smooth scrolling

Sections: Hero, About Me, Skills, Projects, Contact Information

Use semantic HTML and clear structure

Resume Intelligence:

Extract name, role, summary, skills, projects, and links from the resume

If a GitHub username is found, try loading avatar from
https://github.com/USERNAME.png

If successful, use it as profile image and link GitHub icon

If not, try LinkedIn profile image

If all fail, use this default image only:
https://images.unsplash.com/illustrations/a-drawing-of-a-man-wearing-a-tie-7EbR-jFH7cI

Do not guess usernames or create fake links

Output:

Return only the complete HTML code

Ready to open directly in a browser `
      });
      return response.text;
    } catch (error) {
      lastError = error;
      
      // Check if it's a quota exceeded error (429)
      if (error.status === 429) {
        // Try to extract retry delay from error
        let retryDelay = initialDelay * Math.pow(2, attempt); // Exponential backoff
        
        // Check if the error message contains a specific retry time
        const retryMatch = error.message?.match(/retry in ([\d.]+)s/);
        if (retryMatch) {
          retryDelay = Math.ceil(parseFloat(retryMatch[1]) * 1000);
        }
        
        if (attempt < retries - 1) {
          console.log(`Quota exceeded. Retrying in ${retryDelay / 1000} seconds... (Attempt ${attempt + 1}/${retries})`);
          await sleep(retryDelay);
          continue;
        }
        
        // If all retries exhausted, throw a more informative error
        throw new Error(
          `Gemini API quota exceeded. Please wait and try again later, or upgrade your plan at https://ai.google.dev/pricing. ` +
          `Original error: ${error.message}`
        );
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
}