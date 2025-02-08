import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Validate API key at startup
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('Missing Anthropic API Key');
}

// Log first few characters of API key for verification
console.log('API Key starts with:', apiKey.substring(0, 10));

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface FactCheckResponse {
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

// Add this interface after the FactCheckResponse interface
interface ReliabilityIndicator {
  score: number;
  color: string;
}

function getReliabilityColor(score: number): string {
  if (score >= 8) return '#15803D'; // Green for high reliability
  if (score >= 5) return '#CA8A04'; // Yellow for medium reliability
  return '#DC2626'; // Red for low reliability
}

// Add this helper function at the top after imports
function sanitizeJsonString(str: string): string {
  return str
    // Remove control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Escape quotes and backslashes
    .replace(/\\(?!["\\/bfnrt])/g, '\\\\')
    .replace(/"/g, '\\"')
    // Replace line breaks and tabs with spaces
    .replace(/[\n\r\t]/g, ' ')
    // Remove multiple spaces
    .replace(/ +/g, ' ')
    .trim();
}

async function scrapeWebpage(url: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000 // 10 second timeout
    });

    const $ = cheerio.load(response.data);
    
    // Remove script tags, style tags, and comments
    $('script').remove();
    $('style').remove();
    $('comments').remove();
    $('meta').remove();
    $('head').remove();
    $('nav').remove();
    $('footer').remove();
    $('header').remove();
    $('.advertisement').remove();
    
    // Try to get the main article content first
    let text = '';
    const articleSelectors = ['article', '.article-content', '.article-body', '.story-body', 'main', '#main-content'];
    
    for (const selector of articleSelectors) {
      const content = $(selector).text();
      if (content && content.length > text.length) {
        text = content;
      }
    }
    
    // If no article content found, fall back to body content
    if (!text.trim()) {
      text = $('body').text();
    }
    
    // Clean up the text
    text = text.replace(/\s+/g, ' ').trim();
    
    if (!text.trim()) {
      throw new Error('No content could be extracted from the webpage');
    }

    return text;
  } catch (error: any) {
    console.error('Error scraping webpage:', {
      url,
      error: error.message,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    if (error.response?.status === 403) {
      throw new Error('This website is protected against scraping. Please copy and paste the article text directly.');
    } else if (error.response?.status === 404) {
      throw new Error('The webpage could not be found. Please check the URL and try again.');
    } else if (error.response?.status === 429) {
      throw new Error('Too many requests. Please try again later.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('The request timed out. Please try again or use a different URL.');
    } else {
      throw new Error('Failed to fetch webpage content. For paywalled articles, please copy and paste the text directly.');
    }
  }
}

async function validateUrl(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url, {
      timeout: 5000,
      validateStatus: (status) => status < 400
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function searchReliableSources(query: string): Promise<Array<{title: string, url: string, relevance: string}>> {
  // Define reliable fact-checking domains with their proper search URL formats
  const reliableSources = [
    // Primary Fact-Checking Organizations
    {
      domain: 'reuters.com',
      searchUrl: (q: string) => `https://www.reuters.com/search/news?blob=${encodeURIComponent(q)}`,
      title: 'Reuters'
    },
    {
      domain: 'apnews.com',
      searchUrl: (q: string) => `https://apnews.com/search?q=${encodeURIComponent(q)}&searchBy=text`,
      title: 'Associated Press'
    },
    {
      domain: 'factcheck.org',
      searchUrl: (q: string) => `https://www.factcheck.org/?s=${encodeURIComponent(q)}`,
      title: 'FactCheck.org'
    },
    {
      domain: 'snopes.com',
      searchUrl: (q: string) => `https://www.snopes.com/?s=${encodeURIComponent(q)}`,
      title: 'Snopes'
    },
    {
      domain: 'politifact.com',
      searchUrl: (q: string) => `https://www.politifact.com/search/?q=${encodeURIComponent(q)}`,
      title: 'PolitiFact'
    },
    // Major News Organizations
    {
      domain: 'nytimes.com',
      searchUrl: (q: string) => `https://www.nytimes.com/search?dropmab=true&query=${encodeURIComponent(q)}&sort=best`,
      title: 'The New York Times'
    },
    {
      domain: 'washingtonpost.com',
      searchUrl: (q: string) => `https://www.washingtonpost.com/search/?query=${encodeURIComponent(q)}&facets=%7B%22time%22%3A%22all%22%7D`,
      title: 'The Washington Post'
    },
    {
      domain: 'bbc.com',
      searchUrl: (q: string) => `https://www.bbc.com/search?q=${encodeURIComponent(q)}&d=news`,
      title: 'BBC News'
    },
    {
      domain: 'npr.org',
      searchUrl: (q: string) => `https://www.npr.org/search?query=${encodeURIComponent(q)}&page=1`,
      title: 'NPR'
    },
    {
      domain: 'wsj.com',
      searchUrl: (q: string) => `https://www.wsj.com/search?query=${encodeURIComponent(q)}&isToggleOn=true&operator=AND`,
      title: 'Wall Street Journal'
    },
    // International Fact-Checkers
    {
      domain: 'fullfact.org',
      searchUrl: (q: string) => `https://fullfact.org/search/?q=${encodeURIComponent(q)}`,
      title: 'Full Fact UK'
    },
    {
      domain: 'aap.com.au',
      searchUrl: (q: string) => `https://www.aap.com.au/search/${encodeURIComponent(q)}/`,
      title: 'AAP FactCheck'
    },
    {
      domain: 'afp.com',
      searchUrl: (q: string) => `https://factcheck.afp.com/search?keyword=${encodeURIComponent(q)}`,
      title: 'AFP Fact Check'
    },
    // Science and Health Sources
    {
      domain: 'sciencedirect.com',
      searchUrl: (q: string) => `https://www.sciencedirect.com/search?qs=${encodeURIComponent(q)}`,
      title: 'ScienceDirect'
    },
    {
      domain: 'who.int',
      searchUrl: (q: string) => `https://www.who.int/home/search?indexCatalogue=genericsearchindex1&searchQuery=${encodeURIComponent(q)}`,
      title: 'World Health Organization'
    },
    {
      domain: 'cdc.gov',
      searchUrl: (q: string) => `https://search.cdc.gov/search?query=${encodeURIComponent(q)}`,
      title: 'CDC'
    },
    // Academic and Research Institutions
    {
      domain: 'scholar.google.com',
      searchUrl: (q: string) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`,
      title: 'Google Scholar'
    },
    {
      domain: 'jstor.org',
      searchUrl: (q: string) => `https://www.jstor.org/action/doBasicSearch?Query=${encodeURIComponent(q)}`,
      title: 'JSTOR'
    },
    // Government Sources
    {
      domain: 'congress.gov',
      searchUrl: (q: string) => `https://www.congress.gov/search?q=${encodeURIComponent(q)}`,
      title: 'Congress.gov'
    },
    {
      domain: 'usa.gov',
      searchUrl: (q: string) => `https://search.usa.gov/search?query=${encodeURIComponent(q)}`,
      title: 'USA.gov'
    },
    // Additional News Sources
    {
      domain: 'economist.com',
      searchUrl: (q: string) => `https://www.economist.com/search?q=${encodeURIComponent(q)}`,
      title: 'The Economist'
    },
    {
      domain: 'theguardian.com',
      searchUrl: (q: string) => `https://www.theguardian.com/search?q=${encodeURIComponent(q)}`,
      title: 'The Guardian'
    },
    {
      domain: 'bloomberg.com',
      searchUrl: (q: string) => `https://www.bloomberg.com/search?query=${encodeURIComponent(q)}`,
      title: 'Bloomberg'
    },
    {
      domain: 'nature.com',
      searchUrl: (q: string) => `https://www.nature.com/search?q=${encodeURIComponent(q)}`,
      title: 'Nature'
    },
    {
      domain: 'science.org',
      searchUrl: (q: string) => `https://www.science.org/action/doSearch?q=${encodeURIComponent(q)}`,
      title: 'Science'
    }
  ];

  try {
    // Generate sources with proper search URLs
    const sources = reliableSources.map(source => ({
      title: `${source.title} fact-check results`,
      url: source.searchUrl(query),
      relevance: `Fact-check results from ${source.title}`
    }));

    // Validate each URL and only keep the first 3 valid ones with highest reliability
    const validatedSources = [];
    for (const source of sources) {
      const isValid = await validateUrl(source.url);
      if (isValid) {
        validatedSources.push(source);
        if (validatedSources.length === 3) break;
      }
    }

    return validatedSources;
  } catch (error) {
    console.error('Error searching sources:', error);
    return [];
  }
}

// Helper function to extract and clean JSON from Claude's response
function extractAndCleanJson(text: string): any {
  try {
    // Find the JSON object in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }

    let jsonStr = jsonMatch[0];
    
    // Basic cleaning that we know works
    jsonStr = jsonStr
      // Remove control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Replace line breaks and tabs with spaces
      .replace(/[\n\r\t]/g, ' ')
      // Remove multiple spaces
      .replace(/ +/g, ' ')
      .trim();

    // Try to parse the JSON
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    console.error('JSON string:', text);
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (!body.type || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: type and content' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { type, content } = body;
    let textToAnalyze = '';

    if (type === 'url') {
      textToAnalyze = await scrapeWebpage(content);
    } else {
      textToAnalyze = content;
    }

    const requestBody = {
      model: type === 'image' 
        ? "claude-3-sonnet-20240229-v1h"
        : "claude-3-haiku-20240307",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `Analyze this content for factual accuracy. Extract key claims and search for verification.

Content to analyze: ${textToAnalyze}

First, identify up to 3 main claims or statements that need verification. Then, for each claim:
1. Search reliable sources for verification
2. Compare the claim against verified facts
3. Provide direct links to fact-checking articles or primary sources (max 3 sources)

Return ONLY a JSON object in this exact format, with no additional text or explanation:
{
  "transcription": "content summary",
  "reliability_score": 1-10,
  "reliability_explanation": "score justification",
  "is_factual": true/false,
  "analysis": "detailed analysis",
  "key_claims": ["list of up to 3 main claims to verify"],
  "false_claims": [{"claim": "false claim", "correction": "truth"}],
  "sources": [{"title": "source", "url": "url", "relevance": "specific claim this source verifies"}]
}`
      }],
      system: "You are a professional fact-checker. Focus on finding and verifying the most significant claims against reliable sources. Return ONLY valid JSON with no additional text."
    };

    const headers = {
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    };

    const response = await axios.post(
      ANTHROPIC_API_URL,
      requestBody,
      { headers }
    );

    if (!response.data || !response.data.content || !response.data.content[0]) {
      throw new Error('Invalid response from Claude');
    }

    const result = response.data.content[0].text;
    console.log('Raw response from Claude:', result);
    
    try {
      const parsedResult = extractAndCleanJson(result);
      
      // Add reliability color
      parsedResult.reliability_indicator = {
        score: parsedResult.reliability_score,
        color: getReliabilityColor(parsedResult.reliability_score)
      };

      // Extract key claims and search for additional sources
      if (parsedResult.key_claims && Array.isArray(parsedResult.key_claims)) {
        const additionalSources = await Promise.all(
          parsedResult.key_claims.map((claim: string) => searchReliableSources(claim))
        );

        // Combine all sources
        const allSources = [
          ...(parsedResult.sources || []),
          ...additionalSources.flat()
        ];

        // Remove duplicates and keep only the top 3 most relevant sources
        const uniqueSources = Array.from(new Set(
          allSources.map(source => JSON.stringify(source))
        )).map(str => JSON.parse(str));

        parsedResult.sources = uniqueSources.slice(0, 3);
      }

      return NextResponse.json(parsedResult, { headers: corsHeaders });
    } catch (error) {
      console.error('Error processing response:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        rawResponse: result
      });
      throw new Error(
        error instanceof Error 
          ? `Failed to process response: ${error.message}`
          : 'Failed to process response'
      );
    }
  } catch (error: any) {
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return NextResponse.json(
      { error: error.response?.data?.error?.message || error.message },
      { status: error.response?.status || 500, headers: corsHeaders }
    );
  }
}