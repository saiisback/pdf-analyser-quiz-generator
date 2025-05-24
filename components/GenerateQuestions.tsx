'use client';

import React, { useState, useEffect } from 'react';
import { BrainCircuit, Loader2, CheckCircle, XCircle, Trophy, ArrowRight, CircleDot, Circle, RefreshCcw } from 'lucide-react';

interface GenerateQuestionsProps {
  sectionTitle: string;
  sectionContent: string;
}

interface Question {
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
}

const GenerateQuestions: React.FC<GenerateQuestionsProps> = ({ sectionTitle, sectionContent }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamedResponse, setStreamedResponse] = useState<string>('');
  
  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

  const generateQuestions = async () => {
    if (!sectionContent.trim()) {
      setError('No content available to generate questions from.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStreamedResponse('');
    setQuestions([]);
    setQuizStarted(false);
    setQuizSubmitted(false);
    setUserAnswers({});
    setScore({ correct: 0, total: 0 });

    try {
      // Prompt construction remains the same
      const prompt = `Based on the following content from the section "${sectionTitle}", 
      generate 10 multiple choice quiz questions with answers. 
      
      For each question:
      1. Create a clear question that tests understanding
      2. Provide exactly 4 options (A, B, C, D)
      3. Clearly indicate which option is correct
      4. Include a brief explanation of why that answer is correct
      
      CONTENT:
      ${sectionContent.slice(0, 15000)} ${sectionContent.length > 15000 ? '...(content truncated)' : ''}
      
      Format your response as a JSON array of question objects with these properties:
      - question: The question text
      - options: Array of 4 possible answers (formatted as "A. option text", "B. option text", etc.)
      - answer: The correct answer (just the letter, e.g., "A")
      - explanation: Brief explanation of the correct answer
      
      IMPORTANT: Return ONLY valid JSON. Do not include markdown formatting, code blocks, or any other text before or after the JSON.
      
      Ensure the questions cover different aspects of the content and vary in difficulty.`;

      // API call remains the same
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with status: ${response.status}, Error: ${errorText}`);
      }

      // Response handling remains the same
      const responseData = await response.json();
      
      if (responseData.error) {
        throw new Error(responseData.error);
      }
      
      if (Array.isArray(responseData) && responseData.length > 0) {
        // Processing remains the same
        const validQuestions = responseData
          .filter(q => q.question && q.options && q.answer)
          .map(q => ({
            ...q,
            answer: typeof q.answer === 'string' ? q.answer.trim().split(/[\.\s]/)[0].toUpperCase() : 'A'
          }));
        
        setQuestions(validQuestions);
        if (validQuestions.length > 0) {
          setScore({ correct: 0, total: validQuestions.length });
        }
      } else {
        throw new Error('Invalid response format from the API');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const startQuiz = () => {
    setQuizStarted(true);
    setQuizSubmitted(false);
    setUserAnswers({});
  };

  const handleAnswerSelect = (questionIdx: number, answer: string) => {
    const newAnswers = {
      ...userAnswers,
      [questionIdx]: answer
    };
    
    setUserAnswers(newAnswers);
    
    // Auto-submit when all questions are answered
    if (Object.keys(newAnswers).length === questions.length) {
      // Add a small delay so the user can see their final selection
      setTimeout(() => {
        let correctCount = 0;
        
        // Calculate score
        questions.forEach((q, idx) => {
          if (newAnswers[idx] === q.answer) {
            correctCount++;
          }
        });
        
        setScore({
          correct: correctCount,
          total: questions.length
        });
        
        setQuizSubmitted(true);
      }, 500); // 500ms delay for better UX
    }
  };

  const resetQuiz = () => {
    setQuizStarted(false);
    setQuizSubmitted(false);
    setUserAnswers({});
  };

  const getAnswerLetter = (option: string): string => {
    const match = option.match(/^([A-D])[.\s]/);
    return match ? match[1] : '';
  };

  const getScorePercentage = () => {
    return Math.round((score.correct / score.total) * 100);
  };

  const getScoreMessage = () => {
    const percentage = getScorePercentage();
    if (percentage >= 90) return "EXCELLENT";
    if (percentage >= 80) return "GREAT WORK";
    if (percentage >= 70) return "GOOD PROGRESS";
    if (percentage >= 60) return "KEEP PRACTICING";
    return "NEEDS REVIEW";
  };

  return (
    <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-md p-5 font-mono">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-mono text-white tracking-wide">
          QUIZ: {sectionTitle.toUpperCase()}
        </h2>
        {!quizStarted ? (
          <button
            onClick={questions.length > 0 ? startQuiz : generateQuestions}
            disabled={isGenerating}
            className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white font-mono text-xs py-1.5 px-3 rounded-sm border border-zinc-700 disabled:opacity-50 transition-colors duration-200"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>GENERATING</span>
              </>
            ) : questions.length > 0 ? (
              <>
                <ArrowRight className="h-3.5 w-3.5" />
                <span>START QUIZ</span>
              </>
            ) : (
              <>
                <BrainCircuit className="h-3.5 w-3.5" />
                <span>GENERATE QUIZ</span>
              </>
            )}
          </button>
        ) : (
          quizSubmitted && (
            <button
              onClick={resetQuiz}
              className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white font-mono text-xs py-1.5 px-3 rounded-sm border border-zinc-700 transition-colors duration-200"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <span>RETRY</span>
            </button>
          )
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 text-red-400 rounded-sm text-xs">
          ERROR: {error}
        </div>
      )}

      {isGenerating && (
        <div className="mb-4">
          <div className="w-full bg-zinc-900 rounded-full h-0.5 mb-2">
            <div className="bg-white h-0.5 rounded-full animate-pulse"></div>
          </div>
          <p className="text-xs text-zinc-500">
            PROCESSING CONTENT...
          </p>
        </div>
      )}

      {quizSubmitted && (
        <div className="mb-6 p-4 bg-zinc-900 rounded-sm border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-white mb-1">RESULTS</h3>
              <p className="text-zinc-400 text-xs">
                SCORE: {score.correct}/{score.total} ({getScorePercentage()}%)
              </p>
              <p className="text-zinc-300 mt-2 text-xs font-bold tracking-wide">{getScoreMessage()}</p>
            </div>
            <div className="flex items-center justify-center bg-zinc-950 p-3 rounded-full h-16 w-16 border border-zinc-800">
              <div className="text-center">
                <div className="font-bold text-white text-lg">{getScorePercentage()}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {quizStarted && questions.length > 0 && (
        <div className="space-y-6">
          {questions.map((q, idx) => (
            <div key={idx} className={`border rounded-sm p-4 ${
              quizSubmitted 
                ? userAnswers[idx] === q.answer 
                  ? 'bg-green-900/10 border-green-800/30' 
                  : 'bg-red-900/10 border-red-800/30'
                : 'bg-zinc-900 border-zinc-800'
            }`}>
              <h3 className="font-medium text-white text-xs mb-3 flex items-start">
                <span className="bg-zinc-800 text-zinc-300 rounded-sm px-1.5 py-0.5 mr-2 text-[10px] mt-0.5">Q{idx + 1}</span>
                <span>{q.question}</span>
              </h3>
              
              {q.options && q.options.length > 0 && (
                <div className="ml-4 mb-4 space-y-2">
                  {q.options.map((option, optIdx) => {
                    const answerLetter = getAnswerLetter(option);
                    const isSelected = userAnswers[idx] === answerLetter;
                    const isCorrect = q.answer === answerLetter;
                    
                    return (
                      <div key={optIdx} className={`
                        flex items-start p-2 rounded-sm cursor-pointer
                        ${quizSubmitted && isCorrect ? 'bg-green-900/20' : ''}
                        ${quizSubmitted && isSelected && !isCorrect ? 'bg-red-900/20' : ''}
                        ${!quizSubmitted && isSelected ? 'bg-zinc-800' : ''}
                        ${!quizSubmitted && !isSelected ? 'hover:bg-zinc-800/50' : ''}
                        transition-colors duration-150
                      `}
                      onClick={() => !quizSubmitted && handleAnswerSelect(idx, answerLetter)}
                      >
                        {!quizSubmitted ? (
                          isSelected ? (
                            <CircleDot className="h-4 w-4 mr-2 text-white flex-shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 mr-2 text-zinc-600 flex-shrink-0" />
                          )
                        ) : (
                          isCorrect ? (
                            <CheckCircle className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                          ) : (
                            isSelected ? (
                              <XCircle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 mr-2 text-zinc-600 flex-shrink-0" />
                            )
                          )
                        )}
                        <span className={`text-xs ${
                          isSelected && !quizSubmitted ? 'text-white' : 
                          quizSubmitted && isCorrect ? 'text-green-400' :
                          quizSubmitted && isSelected ? 'text-red-400' :
                          'text-zinc-400'
                        }`}>{option}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {quizSubmitted && q.explanation && (
                <div className="mt-3 p-3 bg-zinc-950 rounded-sm border-l-2 border-zinc-700">
                  <div className="font-medium text-zinc-400 text-[10px] mb-1">EXPLANATION:</div>
                  <div className="text-zinc-500 text-xs">{q.explanation}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {!quizStarted && questions.length > 0 && (
        <div className="p-6 bg-zinc-900 rounded-sm border border-zinc-800 text-center">
          <h3 className="text-xs font-bold text-white mb-2 tracking-wide">QUIZ READY</h3>
          <p className="text-zinc-400 text-xs mb-4">
            10 questions have been generated. Test your knowledge.
          </p>
          <button
            onClick={startQuiz}
            className="inline-flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-white font-mono text-xs py-2 px-4 rounded-sm border border-zinc-700 transition-colors duration-200"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>START QUIZ</span>
          </button>
        </div>
      )}

      {!quizSubmitted && quizStarted && (
        <div className="mt-4 p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-sm">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-500">PROGRESS: </span>
              <span className="text-white">{Object.keys(userAnswers).length}/{questions.length}</span>
            </div>
            <div className="text-[10px] text-zinc-500">
              {Object.keys(userAnswers).length === questions.length ? 
                'ALL QUESTIONS ANSWERED' : 
                'SELECT AN ANSWER FOR EACH QUESTION'}
            </div>
          </div>
          <div className="w-full bg-zinc-800 h-1 mt-2 rounded-full overflow-hidden">
            <div 
              className="bg-white h-1 transition-all duration-300 ease-out"
              style={{ width: `${(Object.keys(userAnswers).length / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateQuestions;