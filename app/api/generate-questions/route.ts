// filepath: /Users/saikarthik/Desktop/Projects/workspace/sdas/app/api/generate-questions/route.ts
import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Initialize Groq client
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    // Call Groq API
    const completion = await groq.chat.completions.create({
      model: "deepseek-r1-distill-llama-70b",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.6,
      max_completion_tokens: 2048,
      top_p: 0.95,
      stream: false // Set to false to get complete response
    });

    // Extract the response content
    const content = completion.choices[0].message.content || "";
    
    // Try to extract JSON from the response
    let jsonContent;
    try {
      // Clean the response - remove any markdown code blocks and other text
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      // Parse the JSON
      jsonContent = JSON.parse(jsonStr);
      
      // Validate it's an array of questions
      if (!Array.isArray(jsonContent)) {
        throw new Error('Response is not an array');
      }
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      console.log('Raw content:', content);
      return Response.json({ error: 'Failed to parse response as JSON' }, { status: 500 });
    }

    // Return the JSON response
    return Response.json(jsonContent);
  } catch (error) {
    console.error('Error in API route:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' }, 
      { status: 500 }
    );
  }
}