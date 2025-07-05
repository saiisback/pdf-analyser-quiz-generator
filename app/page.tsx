'use client';

import React, { useState } from 'react';
import PdfTextExtractor from '@/components/PdfTextExtractor';
import { FileText, Upload } from 'lucide-react';

const Home = () => {
  const [file, setFile] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-6 max-w-4xl">
        <header className="mb-12 pt-8">
          <h1 className="text-3xl font-mono font-bold tracking-tighter mb-2 flex items-center">
            <FileText className="mr-3 h-8 w-8" />
            DOCUMENT ANALYZER
          </h1>
          <p className="text-zinc-500 font-mono text-sm">Extract, analyze, and generate questions from PDF documents</p>
        </header>
        
        <div className="mb-10 border border-zinc-800 rounded-md p-6 bg-zinc-950">
          <label className="block font-mono text-sm text-zinc-300 mb-4">
            SELECT PDF FILE
          </label>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
            />
            <div className="border-2 border-dashed border-zinc-800 rounded-md p-8 text-center hover:border-zinc-700 transition-colors duration-200">
              <Upload className="h-8 w-8 mx-auto mb-3 text-zinc-700" />
              <p className="font-mono text-sm text-zinc-500">
                {file ? file.name : 'Drag & drop your PDF or click to browse'}
              </p>
              {file && (
                <p className="mt-2 text-xs text-zinc-600 font-mono">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
          </div>
        </div>
        
        {file && <PdfTextExtractor file={file} />}
        
        <footer className="mt-16 pt-6 border-t border-zinc-900 text-zinc-600 text-xs font-mono">
          <p className="text-center">© 2025 DOCUMENT ANALYZER Made by Sai karthik ketha</p>
        </footer>
      </div>
    </div>
  );
};

export default Home;