import { NextRequest } from 'next/server';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';
import { generateObject } from 'ai';

// Define Zod schema for structured output
const SectionSchema = z.object({
  title: z.string().nonempty(),
  content: z.string().optional().default(''),
  level: z.number().int().min(1).max(5),
});

const DocumentStructureSchema = z.object({
  sections: z.array(SectionSchema),
});

export async function POST(req: NextRequest) {
  try {
    const { text, isFirstChunk, isLastChunk, chunkIndex } = await req.json();
    
    if (!text) {
      return Response.json({ error: 'Text content is required' }, { status: 400 });
    }

    // Use a smaller model that has higher rate limits
    const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // Alternative to llama-3.3-70b-versatile
    
    const contextPrompt = isFirstChunk 
      ? 'This is the beginning of the document.' 
      : `This is chunk ${chunkIndex} of the document.`;

    // Use a more concise prompt to reduce token usage
    const prompt = `
    ${contextPrompt}
    
    Analyze this text and identify its structure (chapters, sections, subsections).
    - Look for "Chapter X", numbered sections, ALL CAPS headings, etc.
    - Level 1 = main chapters, Level 2 = subsections, Level 3+ = deeper
    - Include content between headings
    
    TEXT:
    ${text}
    `;

    // Using generateObject from Vercel AI SDK with Groq
    const result = await generateObject({
      model: groq(MODEL),
      schema: DocumentStructureSchema,
      prompt: prompt,
      temperature: 0.2,
      system: "You are a document structure analyzer. Be concise and accurate.",
    });
    
    return Response.json(result.object);
  } catch (error) {
    console.error('Error in API route:', error);
    
    // Check if it's a rate limit error and provide a more helpful message
    if (error instanceof Error && error.message.includes('Rate limit reached')) {
      return Response.json(
        { 
          error: 'Rate limit reached. Please try again in a minute or reduce document size.',
          retryAfter: '60', // Suggest retry after 60 seconds
          sections: [] 
        }, 
        { 
          status: 429,
          headers: {
            'Retry-After': '60'
          }
        }
      );
    }
    
    return Response.json(
      { 
        error: error instanceof Error ? error.message : 'Error analyzing document structure',
        sections: [] 
      }, 
      { status: 500 }
    );
  }
}