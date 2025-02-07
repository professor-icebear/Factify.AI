'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Playfair_Display } from 'next/font/google';

const playfair = Playfair_Display({ subsets: ["latin"] });

interface FactCheckResponse {
  transcription: string;
  reliability_score: number;
  reliability_explanation: string;
  is_factual: boolean;
  analysis: string;
  false_claims: Array<{
    claim: string;
    correction: string;
  }>;
  sources: Array<{
    title: string;
    url: string;
    relevance: string;
  }>;
}

export default function Home() {
  const [inputType, setInputType] = useState<'text' | 'url' | 'image'>('text');
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<FactCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      // Check original file size
      if (file.size > 2 * 1024 * 1024) { // 2MB
        setError('Please select an image under 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Maximum dimensions - adjusted for token limit
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          
          // Calculate scale factor to maintain aspect ratio
          let scale = 1;
          if (width > height) {
            if (width > MAX_WIDTH) {
              scale = MAX_WIDTH / width;
            }
          } else {
            if (height > MAX_HEIGHT) {
              scale = MAX_HEIGHT / height;
            }
          }
          
          // Apply scale to both dimensions
          width = Math.floor(width * scale);
          height = Math.floor(height * scale);
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          // Use better image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with medium-high quality
          let quality = 0.8;
          let compressedImage = canvas.toDataURL('image/jpeg', quality);
          
          // Reduce quality until size is acceptable
          while (compressedImage.length > 750 * 1024 && quality > 0.4) { // 750KB limit
            quality -= 0.1;
            compressedImage = canvas.toDataURL('image/jpeg', quality);
          }
          
          // Final size check
          if (compressedImage.length > 750 * 1024) {
            setError('Image is too complex. Please try a simpler image or one with fewer details.');
            return;
          }
          
          setInput(compressedImage);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      setError('Please upload an image file');
    }
  };

  const handleSubmit = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      setResult(null);

      // Check input size for images - accounting for base64 encoding overhead
      if (inputType === 'image') {
        // Convert base64 length to approximate file size in KB
        const base64Length = input.length;
        const base64PureLength = base64Length * 0.75; // Remove base64 overhead
        const approximateFileSize = base64PureLength / 1024; // Convert to KB
        
        if (approximateFileSize > 1000) { // 1MB limit
          throw new Error('Image is too large. Please use an image under 1MB.');
        }
      }

      const response = await fetch('/api/factcheck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: inputType,
          content: input,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze content');
      }

      setResult(data);
    } catch (err) {
      console.error('Error:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const buttonVariants = {
    hover: { 
      scale: 1.02,
      boxShadow: "0 10px 20px rgba(163, 29, 29, 0.1)",
      transition: {
        duration: 0.2,
        ease: "easeInOut"
      }
    },
    tap: { 
      scale: 0.98,
      boxShadow: "0 5px 10px rgba(163, 29, 29, 0.1)",
      transition: {
        duration: 0.1,
        ease: "easeInOut"
      }
    }
  };

  const floatAnimation = {
    initial: { y: 0 },
    animate: {
      y: [-5, 5, -5],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center mb-16"
      >
        <motion.div
          variants={floatAnimation}
          initial="initial"
          animate="animate"
          className="inline-block"
        >
          <h1 className={`${playfair.className} text-7xl font-bold mb-6 bg-gradient-to-r from-wine via-wine to-wine-dark bg-clip-text text-transparent`}>
            Factify.AI
          </h1>
        </motion.div>
        <p className="text-xl text-wine-dark/80">
          Illuminate truth through AI-powered fact verification
        </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-3xl mx-auto"
      >
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-cream-muted/20">
          <div className="flex gap-4 mb-8">
            {['text', 'url', 'image'].map((type) => (
              <motion.button
                key={type}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                onClick={() => {
                  setInputType(type as 'text' | 'url' | 'image');
                  setInput('');
                }}
                className={`flex-1 py-3 px-6 rounded-xl transition-all ${
                  inputType === type
                    ? 'bg-wine text-cream shadow-lg'
                    : 'bg-cream-muted/30 text-wine hover:bg-cream-muted/50'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </motion.button>
            ))}
          </div>

          {inputType === 'image' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-3 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-wine bg-wine/5'
                  : 'border-wine/30 hover:border-wine hover:bg-wine/5'
              }`}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {input ? (
                  <div className="relative w-full aspect-video max-w-md mx-auto">
                    <img
                      src={input}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-xl shadow-lg"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInput('');
                      }}
                      className="absolute -top-2 -right-2 bg-wine text-cream w-8 h-8 rounded-full hover:bg-wine-dark transition-colors shadow-lg"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <p className="text-wine-dark/60">
                    Drag and drop an image here, or click to select
                  </p>
                )}
              </motion.div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          ) : (
            <textarea
              className="w-full h-40 bg-cream/50 text-wine-dark rounded-xl p-5 focus:outline-none focus:ring-2 focus:ring-wine/30 transition-all resize-none"
              placeholder={
                inputType === 'text'
                  ? 'Enter the text you want to fact-check...'
                  : 'Enter the URL of the webpage you want to analyze...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          )}

          <motion.button
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className="w-full mt-8 bg-gradient-to-r from-wine to-wine-dark text-cream py-4 rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!input || isAnalyzing}
          >
            {isAnalyzing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-cream border-t-transparent rounded-full animate-spin" />
                <span>Analyzing...</span>
              </div>
            ) : (
              'Verify Facts'
            )}
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-red-500/10 border border-red-500/20 text-red-600 p-4 rounded-xl mt-6"
            >
              {error}
            </motion.div>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-cream-muted/20 mt-8"
            >
              {result.transcription && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8"
                >
                  <h2 className={`${playfair.className} text-2xl font-bold text-wine mb-4`}>Content Description</h2>
                  <p className="text-wine-dark/80 leading-relaxed">{result.transcription}</p>
                </motion.div>
              )}

              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`${playfair.className} text-2xl font-bold text-wine`}>Reliability Score</h2>
                  <div className="flex items-center gap-2">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      className="w-16 h-16 rounded-full border-4 border-wine flex items-center justify-center shadow-lg"
                    >
                      <span className="text-2xl font-bold text-wine">{result.reliability_score}</span>
                    </motion.div>
                    <span className="text-wine-dark/60">/10</span>
                  </div>
                </div>
                {result.reliability_explanation && (
                  <p className="text-wine-dark/80 mb-4 italic">
                    {result.reliability_explanation}
                  </p>
                )}
                <div className={`p-6 rounded-xl ${
                  result.is_factual ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-lg font-medium ${result.is_factual ? 'text-green-700' : 'text-red-700'}`}>
                    {result.is_factual ? 'Content is factual' : 'Content contains false claims'}
                  </p>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <h2 className={`${playfair.className} text-2xl font-bold text-wine mb-4`}>Analysis</h2>
                <p className="text-wine-dark/80 leading-relaxed">{result.analysis}</p>
              </motion.div>

              {result.false_claims.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mb-8"
                >
                  <h2 className={`${playfair.className} text-2xl font-bold text-wine mb-4`}>False Claims</h2>
                  <div className="space-y-4">
                    {result.false_claims.map((claim, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="bg-red-50 border border-red-200 p-6 rounded-xl"
                      >
                        <p className="text-red-700 font-medium mb-3">Claim: {claim.claim}</p>
                        <p className="text-green-700">Correction: {claim.correction}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {result.sources.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <h2 className={`${playfair.className} text-2xl font-bold text-wine mb-4`}>Sources</h2>
                  <div className="space-y-3">
                    {result.sources.map((source, index) => (
                      <motion.a
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-cream/50 rounded-xl hover:bg-cream transition-colors shadow-sm"
                      >
                        {source.title}
                      </motion.a>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
