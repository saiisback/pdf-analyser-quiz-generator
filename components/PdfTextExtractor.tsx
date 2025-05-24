'use client';

import React, { useState, useEffect } from 'react';
import GenerateQuestions from './GenerateQuestions';
import { ChevronDown, ChevronRight, Code, FileText, Layers, Zap, BookOpen } from 'lucide-react';
import { z } from 'zod';

interface PdfTextExtractorProps {
  file: File;
}

interface Section {
  title: string;
  content: string;
  level: number;
  id: string;
  parent?: string;
  children: string[];
}

// Define Zod schema for structured output validation
const SectionSchema = z.object({
  title: z.string(),
  content: z.string(),
  level: z.number().min(1).max(5),
});

const DocumentStructureSchema = z.array(SectionSchema);

const PdfTextExtractor: React.FC<PdfTextExtractorProps> = ({ file }) => {
  const [textContent, setTextContent] = useState<string>('');
  const [organizedContent, setOrganizedContent] = useState<Section[]>([]);
  const [extractionStatus, setExtractionStatus] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [aiProcessing, setAiProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (file) {
      extractTextFromDocument();
    }
  }, [file]);

  const extractTextFromDocument = async () => {
    if (!file) {
      setExtractionStatus('No file provided');
      return;
    }

    try {
      setIsExtracting(true);
      setOrganizedContent([]);
      
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (fileExt !== 'pdf') {
        throw new Error('Unsupported file format. Only PDF files are supported.');
      }
      
      setExtractionStatus('UPLOADING PDF AND EXTRACTING TEXT...');

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/extract-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.parsedText) {
        setTextContent(data.parsedText);
        setExtractionStatus('TEXT EXTRACTION COMPLETE. ANALYZING DOCUMENT STRUCTURE WITH AI...');
        
        // Use AI to analyze document structure
        await analyzeDocumentStructure(data.parsedText);
      } else {
        setExtractionStatus('No text could be extracted from the document.');
      }
    } catch (error: unknown) {
      console.error('Error extracting text:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during extraction';
      setExtractionStatus(`ERROR: ${errorMessage}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const analyzeDocumentStructure = async (text: string) => {
    try {
      setAiProcessing(true);
      
      // Process text in chunks if it's very large
      const MAX_CHUNK_SIZE = 25000;
      const chunks = [];
      
      for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
        chunks.push(text.substring(i, i + MAX_CHUNK_SIZE));
      }
      
      setExtractionStatus(`ANALYZING DOCUMENT STRUCTURE (${chunks.length} CHUNKS)...`);
      
      let allSections: Section[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        setExtractionStatus(`PROCESSING CHUNK ${i+1}/${chunks.length}...`);
        
        const response = await fetch('/api/analyze-structure', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: chunks[i],
            isFirstChunk: i === 0,
            isLastChunk: i === chunks.length - 1,
            chunkIndex: i
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to analyze document structure: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.sections && Array.isArray(result.sections)) {
          // Generate unique IDs for each section
          const newSections = result.sections.map((section: any, index: number) => ({
            ...section,
            id: `section-${i}-${index}`,
            children: []
          }));
          
          allSections = [...allSections, ...newSections];
        }
      }
      
      // Establish parent-child relationships based on section levels
      const processedSections = establishHierarchy(allSections);
      
      setOrganizedContent(processedSections);
      
      // Expand first main section by default
      const firstMainSection = processedSections.find(s => s.level === 1);
      if (firstMainSection) {
        setExpandedSections(new Set([firstMainSection.id]));
      }
      
      setExtractionStatus(`DOCUMENT ANALYSIS COMPLETE: ${processedSections.length} SECTIONS IDENTIFIED`);
    } catch (error) {
      console.error('Error analyzing document structure:', error);
      setExtractionStatus(`ERROR ANALYZING DOCUMENT: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to the traditional method if AI analysis fails
      const sections = organizeIntoSections(text);
      setOrganizedContent(sections);
      
      const firstMainSection = sections.find(s => s.level === 1);
      if (firstMainSection) {
        setExpandedSections(new Set([firstMainSection.id]));
      }
    } finally {
      setAiProcessing(false);
    }
  };
  
  const establishHierarchy = (sections: Section[]): Section[] => {
    // Sort sections by their occurrence in the document
    const sortedSections = [...sections];
    
    // Initialize parent-child relationships
    for (let i = 0; i < sortedSections.length; i++) {
      const currentSection = sortedSections[i];
      
      // Find the closest preceding section with a lower level
      for (let j = i - 1; j >= 0; j--) {
        const potentialParent = sortedSections[j];
        
        if (potentialParent.level < currentSection.level) {
          currentSection.parent = potentialParent.id;
          potentialParent.children.push(currentSection.id);
          break;
        }
      }
    }
    
    return sortedSections;
  };

  // Keep the original organizeIntoSections as a fallback
  const organizeIntoSections = (text: string): Section[] => {
    // Original implementation (keeping as fallback)
    const lines = text.split('\n');
    const sections: Section[] = [];
    let currentSection: Section | null = null;
    
    const chapterPattern = /^(?:\s*)(?:chapter|unit|part|section|module|lesson)(?:\s+)(\d+|[ivxlcdm]+)(?:[.:)\s-]*)(.*)$/i;
    const numberedHeaderPattern = /^(?:\s*)(\d+(?:\.\d+)*)(?:[.:)\s-]+)(.+)$/i;
    const headerKeywords = /^(?:\s*)(introduction|conclusion|abstract|summary|appendix|glossary|references|bibliography|index|acknowledgements|preface|foreword|overview|discussion|results|methodology|findings|analysis|review|contents|table of contents)(?:[\s:.-]*)(.*)$/i;
    const romanNumeralPattern = /^(?:\s*)([ivxlcdm]+)(?:[.:)\s-]+)(.+)$/i;
    const letterHeaderPattern = /^(?:\s*)([A-Z])(?:[.:)\s-]+)(.+)$/;
    const allCapsPattern = /^[A-Z][A-Z\s\d.,;:'"\-]+$/;
    
    const possibleHeaders: {line: string, index: number, score: number, level: number}[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      let score = 0;
      let level = 1;
      
      if (line.length < 30) score += 8;
      else if (line.length < 60) score += 5;
      else if (line.length < 100) score += 2;
      else if (line.length > 200) score -= 8;
      else if (line.length > 150) score -= 5;
      
      const chapterMatch = line.match(chapterPattern);
      const numberedMatch = line.match(numberedHeaderPattern);
      const keywordMatch = line.match(headerKeywords);
      const romanMatch = line.match(romanNumeralPattern);
      const letterMatch = line.match(letterHeaderPattern);
      
      if (chapterMatch) {
        score += 15;
        level = 1;
        if (chapterMatch[2] && chapterMatch[2].trim()) score += 5;
      }
      
      if (numberedMatch) {
        score += 12;
        const dots = (numberedMatch[1].match(/\./g) || []).length;
        level = dots + 1;
        if (numberedMatch[2] && numberedMatch[2].length < 100) score += 3;
      }
      
      if (keywordMatch) {
        score += 10;
        level = 1;
        if (keywordMatch[2] && keywordMatch[2].trim()) score += 2;
      }
      
      if (romanMatch) {
        score += 8;
        level = 1;
      }
      
      if (letterMatch) {
        score += 7;
        level = 2;
      }
      
      if (line.match(allCapsPattern) && line.length < 60) {
        score += 8;
        level = 1;
      } else if (line.match(/^[A-Z][a-z]/) && !line.match(/[\.\,]\s+[a-z]/)) {
        score += 4;
      }
      
      const prevLine = i > 0 ? lines[i-1].trim() : '';
      const nextLine = i < lines.length - 1 ? lines[i+1].trim() : '';
      
      if (!prevLine) score += 3;
      if (!nextLine) score += 1;
      
      if (prevLine && (prevLine.match(/^[-_*=]{3,}$/) || prevLine.match(/^\d+$/))) {
        score += 5;
      }
      
      if (line.includes(':') && line.length < 80) score += 3;
      
      if (i > 1 && !lines[i-2].trim() && !lines[i-1].trim()) {
        score += 4;
      }
      
      if (line.match(/^\d+$/) || line.match(/^Page \d+$/i)) {
        score = -10;
      }
      
      if (line.match(/^[a-z]/) && !line.match(numberedHeaderPattern)) score -= 5;
      if (line.match(/[.]\s+[a-z]/) && line.length > 60) score -= 5;
      if (line.endsWith('.') && line.length > 50 && !line.match(numberedHeaderPattern)) score -= 3;
    
      if (score > 6) {
        possibleHeaders.push({ line, index: i, score, level });
      }
    }
    
    const wordFrequency: Record<string, number> = {};
    possibleHeaders.forEach(header => {
      const words = header.line.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) {
          wordFrequency[word] = (wordFrequency[word] || 0) + 1;
        }
      });
    });
    
    possibleHeaders.forEach(header => {
      const words = header.line.toLowerCase().split(/\s+/);
      let frequencyScore = 0;
      
      words.forEach(word => {
        if (word.length > 3 && wordFrequency[word] > 1) {
          frequencyScore += Math.min(wordFrequency[word], 3);
        }
      });
      
      header.score += frequencyScore;
    });
    
    for (let i = 1; i < possibleHeaders.length; i++) {
      const prev = possibleHeaders[i-1];
      const curr = possibleHeaders[i];
      
      if (curr.index - prev.index === 1 || curr.index - prev.index === 2) {
        if (Math.abs(prev.level - curr.level) <= 1) {
          if (prev.score < curr.score) {
            prev.score -= 5;
          } else {
            curr.score -= 5;
          }
        }
      }
    }
    
    const filteredHeaders = possibleHeaders.filter(h => h.score > 6);
    
    filteredHeaders.sort((a, b) => b.score - a.score);
    
    const headerInfoMap = new Map<number, {score: number, level: number}>();
    filteredHeaders.forEach(header => {
      headerInfoMap.set(header.index, {score: header.score, level: header.level});
    });
    
    let currentContent = '';
    const sectionStack: Section[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) {
        if (currentSection) {
          currentSection.content += '\n';
        } else if (currentContent) {
          currentContent += '\n';
        }
        continue;
      }
      
      const headerInfo = headerInfoMap.get(i);
      if (headerInfo) {
        if (currentSection) {
          currentSection.content = currentSection.content.trim();
          sections.push(currentSection);
        }
        
        let level = headerInfo.level;
        let title = line;
        
        const chapterMatch = line.match(chapterPattern);
        const numberedMatch = line.match(numberedHeaderPattern);
        const keywordMatch = line.match(headerKeywords);
        const romanMatch = line.match(romanNumeralPattern);
        const letterMatch = line.match(letterHeaderPattern);
        
        if (chapterMatch) {
          title = chapterMatch[2] && chapterMatch[2].trim() 
            ? `Chapter ${chapterMatch[1]}: ${chapterMatch[2].trim()}`
            : `Chapter ${chapterMatch[1]}`;
        } else if (numberedMatch) {
          title = numberedMatch[2] && numberedMatch[2].trim()
            ? numberedMatch[2].trim()
            : `Section ${numberedMatch[1]}`;
        } else if (keywordMatch) {
          title = keywordMatch[2] && keywordMatch[2].trim()
            ? `${keywordMatch[1].charAt(0).toUpperCase() + keywordMatch[1].slice(1)}: ${keywordMatch[2].trim()}`
            : keywordMatch[1].charAt(0).toUpperCase() + keywordMatch[1].slice(1);
        } else if (romanMatch) {
          title = romanMatch[2].trim();
        } else if (letterMatch) {
          title = letterMatch[2].trim();
        }
        
        title = title.replace(/[.:;,]+$/, '').trim();
        
        const sectionId = `section-${sections.length + 1}`;
        
        let parentId: string | undefined = undefined;
        
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          sectionStack.pop();
        }
        
        if (sectionStack.length > 0) {
          const parent = sectionStack[sectionStack.length - 1];
          parentId = parent.id;
          parent.children.push(sectionId);
        }
        
        currentSection = {
          id: sectionId,
          title: title,
          content: '',
          level: level,
          parent: parentId,
          children: []
        };
        
        sectionStack.push(currentSection);
      } else if (currentSection) {
        currentSection.content += line + '\n';
      } else {
        currentContent += line + '\n';
      }
    }
    
    if (currentSection) {
      currentSection.content = currentSection.content.trim();
      sections.push(currentSection);
    }
    
    if (currentContent.trim()) {
      const introId = 'section-intro';
      sections.unshift({
        id: introId,
        title: 'Introduction',
        content: currentContent.trim(),
        level: 1,
        children: []
      });
    }
    
    if (sections.length === 0 && text.trim()) {
      sections.push({
        id: 'section-content',
        title: 'Document Content',
        content: text,
        level: 1,
        children: []
      });
    }
    
    const cleanedSections = sections.filter(section => {
      return section.content.trim().length > 20 || section.children.length > 0;
    });
    
    const sectionIdMap = new Map<string, string>();
    cleanedSections.forEach(section => {
      sectionIdMap.set(section.id, section.id);
    });
    
    cleanedSections.forEach(section => {
      section.children = section.children.filter(childId => sectionIdMap.has(childId));
    });
    
    return cleanedSections;
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllSections = () => {
    if (expandedSections.size > 0) {
      setExpandedSections(new Set());
    } else {
      const newSet = new Set<string>();
      organizedContent.forEach(section => {
        newSet.add(section.id);
      });
      setExpandedSections(newSet);
    }
  };

  const getChildSections = (sectionId: string) => {
    return organizedContent.filter(section => section.parent === sectionId);
  };

  const getTopLevelSections = () => {
    return organizedContent.filter(section => !section.parent);
  };

  const SectionItem = ({ section }: { section: Section }) => {
    const isExpanded = expandedSections.has(section.id);
    const childSections = getChildSections(section.id);
    const [showQuestions, setShowQuestions] = useState(false);
    
    return (
      <div className="border-b border-zinc-800 last:border-b-0">
        <button
          onClick={() => toggleSection(section.id)}
          className={`flex justify-between items-center w-full text-left p-3 hover:bg-zinc-900 transition-colors duration-200 ${
            section.level === 1 
              ? 'bg-zinc-900 font-semibold text-white' 
              : section.level === 2
                ? 'bg-zinc-950 text-zinc-300'
                : 'bg-zinc-950 text-zinc-400 text-sm'
          }`}
          style={{ paddingLeft: `${(section.level - 1) * 1.5 + 1}rem` }}
        >
          <div className="flex items-center">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 mr-2 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-2 text-zinc-500" />
            )}
            <span className="font-mono">{section.title}</span>
          </div>
          {childSections.length > 0 && (
            <span className="text-xs text-zinc-500 font-mono">
              {childSections.length} section{childSections.length !== 1 ? 's' : ''}
            </span>
          )}
        </button>
        
        {isExpanded && (
          <div className="p-4 bg-zinc-950 border-t border-zinc-800 text-zinc-300 text-sm">
            <div className="font-mono whitespace-pre-wrap leading-relaxed tracking-tight text-xs">
              {section.content}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowQuestions(!showQuestions)}
                className="flex items-center space-x-2 bg-transparent hover:bg-zinc-800 text-white font-mono text-xs py-1.5 px-3 rounded border border-zinc-700 transition-colors duration-200"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{showQuestions ? 'HIDE QUESTIONS' : 'GENERATE QUESTIONS'}</span>
              </button>
            </div>
            
            {showQuestions && (
              <GenerateQuestions 
                sectionTitle={section.title} 
                sectionContent={section.content} 
              />
            )}
            
            {childSections.length > 0 && (
              <div className="mt-6 border-t border-zinc-800 pt-3">
                <div className="text-xs text-zinc-500 font-mono mb-2 flex items-center">
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  <span>SUBSECTIONS</span>
                </div>
                <div className="border border-zinc-800 rounded-md overflow-hidden">
                  {childSections.map(childSection => (
                    <SectionItem key={childSection.id} section={childSection} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-6 font-mono">
      <button
        onClick={extractTextFromDocument}
        disabled={isExtracting || aiProcessing}
        className="group flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-md hover:bg-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600 border border-zinc-700 transition-all duration-200"
      >
        {isExtracting || aiProcessing ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-opacity-20 border-t-white rounded-full"></div>
            <span>{isExtracting ? 'EXTRACTING...' : 'ANALYZING...'}</span>
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>EXTRACT & ANALYZE</span>
          </>
        )}
      </button>

      {extractionStatus && (
        <div className="my-6 p-4 bg-zinc-950 border border-zinc-800 rounded-md">
          <h3 className="font-mono text-zinc-300 text-sm">STATUS</h3>
          <p className="font-mono text-zinc-400 text-xs mt-1">{extractionStatus}</p>
          {(isExtracting || aiProcessing) && (
            <div className="mt-3 w-full bg-zinc-900 rounded-full h-1">
              <div className="bg-white h-1 rounded-full animate-pulse w-full"></div>
            </div>
          )}
        </div>
      )}

      {organizedContent.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-mono font-bold text-white flex items-center">
              <Code className="mr-2 h-5 w-5" />
              DOCUMENT STRUCTURE
            </h2>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={toggleAllSections}
                className="text-xs text-zinc-400 hover:text-white font-mono transition-colors"
              >
                {expandedSections.size > 0 ? 'COLLAPSE ALL' : 'EXPAND ALL'}
              </button>
              
              <div className="text-xs text-zinc-500 font-mono">
                {organizedContent.length} SECTIONS
              </div>
            </div>
          </div>
          
          <div className="border border-zinc-800 rounded-md overflow-hidden bg-zinc-950 shadow-xl">
            {getTopLevelSections().map(section => (
              <SectionItem key={section.id} section={section} />
            ))}
          </div>
        </div>
      )}
      
      {textContent && !organizedContent.length && !isExtracting && !aiProcessing && (
        <div className="mt-6 p-4 bg-zinc-950 rounded-md border border-zinc-800">
          <h2 className="font-mono font-semibold text-white mb-2">RAW EXTRACTED TEXT:</h2>
          <pre className="font-mono whitespace-pre-wrap text-xs text-zinc-400 tracking-tight max-h-96 overflow-y-auto">
            {textContent.length > 2000 
              ? `${textContent.substring(0, 2000)}... (${(textContent.length / 1000).toFixed(1)}K characters total)` 
              : textContent}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PdfTextExtractor;