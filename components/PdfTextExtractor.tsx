'use client';

import React, { useState, useEffect } from 'react';
import GenerateQuestions from './GenerateQuestions';
import { ChevronDown, ChevronRight, Code, FileText, Layers, Zap } from 'lucide-react';

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

const PdfTextExtractor: React.FC<PdfTextExtractorProps> = ({ file }) => {
  const [textContent, setTextContent] = useState<string>('');
  const [organizedContent, setOrganizedContent] = useState<Section[]>([]);
  const [extractionStatus, setExtractionStatus] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Auto-extract when component mounts or file changes
  useEffect(() => {
    if (file) {
      extractTextFromDocument();
    }
  }, [file]);

  // Extraction function remains the same
  const extractTextFromDocument = async () => {
    if (!file) {
      setExtractionStatus('No file provided');
      return;
    }

    try {
      setIsExtracting(true);
      
      // Check if file is PDF
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (fileExt !== 'pdf') {
        throw new Error('Unsupported file format. Only PDF files are supported.');
      }
      
      setExtractionStatus('Uploading PDF and extracting text...');

      // Create FormData to send the file
      const formData = new FormData();
      formData.append('file', file);

      // Send the file to the API route
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
        setExtractionStatus('Processing document structure...');
        
        // Process the text into chapters and sections
        const sections = organizeIntoSections(data.parsedText);
        setOrganizedContent(sections);
        
        // Expand first main section by default
        const firstMainSection = sections.find(s => s.level === 1);
        if (firstMainSection) {
          setExpandedSections(new Set([firstMainSection.id]));
        }
        
        setExtractionStatus('Text extraction and organization completed successfully!');
      } else {
        setExtractionStatus('No text could be extracted from the document.');
      }
    } catch (error: unknown) {
      console.error('Error extracting text:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during extraction';
      setExtractionStatus(`Error: ${errorMessage}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // organizeIntoSections function remains the same

  // Toggle section visibility
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

  // Expand or collapse all sections
  const toggleAllSections = () => {
    if (expandedSections.size > 0) {
      // Collapse all
      setExpandedSections(new Set());
    } else {
      // Expand all
      const newSet = new Set<string>();
      organizedContent.forEach(section => {
        newSet.add(section.id);
      });
      setExpandedSections(newSet);
    }
  };

  // Helper functions remain the same
  const getChildSections = (sectionId: string) => {
    return organizedContent.filter(section => section.parent === sectionId);
  };

  const getTopLevelSections = () => {
    return organizedContent.filter(section => !section.parent);
  };

  // Recursive component to render sections with their children
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
                <span>{showQuestions ? 'Hide Questions' : 'Generate Questions'}</span>
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
        disabled={isExtracting}
        className="group flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-md hover:bg-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600 border border-zinc-700 transition-all duration-200"
      >
        {isExtracting ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-opacity-20 border-t-white rounded-full"></div>
            <span>EXTRACTING...</span>
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span>EXTRACT TEXT</span>
          </>
        )}
      </button>

      {extractionStatus && (
        <div className="my-6 p-4 bg-zinc-950 border border-zinc-800 rounded-md">
          <h3 className="font-mono text-zinc-300 text-sm">STATUS</h3>
          <p className="font-mono text-zinc-400 text-xs mt-1">{extractionStatus}</p>
          {isExtracting && (
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
      
      {textContent && !organizedContent.length && (
        <div className="mt-6 p-4 bg-zinc-950 rounded-md border border-zinc-800">
          <h2 className="font-mono font-semibold text-white mb-2">RAW EXTRACTED TEXT:</h2>
          <pre className="font-mono whitespace-pre-wrap text-xs text-zinc-400 tracking-tight">{textContent}</pre>
        </div>
      )}
    </div>
  );
};

export default PdfTextExtractor;