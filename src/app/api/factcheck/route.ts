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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    if (!body.type || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: type and content' },
        { status: 400 }
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
        content: type === 'image' 
          ? `Analyze this image for authenticity and factual accuracy. Focus on:
1. Signs of manipulation (lighting, perspective, artifacts)
2. Comparison with known facts
3. Technical analysis of authenticity

Content to analyze: ${textToAnalyze}

Respond in this JSON format:
{
  "transcription": "<detailed description>",
  "reliability_score": <1-3 for manipulated, 4-7 for suspicious, 8-10 for authentic>,
  "reliability_explanation": "<evidence-based explanation>",
  "is_factual": <false if manipulated>,
  "analysis": "<technical analysis and fact comparison>",
  "false_claims": [{"claim": "<what image shows>", "correction": "<reality>"}],
  "sources": [{"title": "<source>", "url": "<url>", "relevance": "<proof>"}]
}`
          : `Analyze this content for factual accuracy.

Content to analyze: ${textToAnalyze}

Respond in this JSON format:
{
  "transcription": "content summary",
  "reliability_score": 1-10,
  "reliability_explanation": "score justification",
  "is_factual": true/false,
  "analysis": "detailed analysis",
  "false_claims": [{"claim": "false claim", "correction": "truth"}],
  "sources": [{"title": "source", "url": "url", "relevance": "relevance"}]
}`
      }],
      system: type === 'image'
        ? "You are a forensic image analyst. Be extremely skeptical and thorough."
        : "You are a fact-checking assistant. Verify claims against reliable sources."
    };

    const headers = {
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    };

    console.log('Making request with body:', {
      ...requestBody,
      messages: [{
        role: "user",
        content: "[content hidden for logs]"
      }]
    });

    const response = await axios.post(
      ANTHROPIC_API_URL,
      requestBody,
      { headers }
    );

    if (!response.data || !response.data.content || !response.data.content[0]) {
      console.error('Invalid response structure:', response.data);
      throw new Error('Invalid response from Claude');
    }

    const result = response.data.content[0].text;
    console.log('Raw response from Claude:', result);
    
    try {
      // Try to clean the response if it contains any leading/trailing characters
      const cleanedResult = result.trim();
      let jsonStart = cleanedResult.indexOf('{');
      let jsonEnd = cleanedResult.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        console.error('Invalid response format:', cleanedResult);
        throw new Error('Could not find valid JSON in response');
      }
      
      const jsonStr = cleanedResult.substring(jsonStart, jsonEnd + 1);
      console.log('Attempting to parse JSON:', jsonStr);
      
      const parsedResult = JSON.parse(jsonStr);
      
      // Validate the required fields
      if (!parsedResult.transcription || 
          !parsedResult.reliability_score || 
          typeof parsedResult.is_factual !== 'boolean' || 
          !parsedResult.analysis) {
        console.error('Missing required fields in response:', parsedResult);
        throw new Error('Response is missing required fields');
      }
      
      return NextResponse.json(parsedResult);
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
      { status: error.response?.status || 500 }
    );
  }
}