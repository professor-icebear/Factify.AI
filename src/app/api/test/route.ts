import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  try {
    // Log the full API key length and first/last few characters
    console.log('API Key length:', apiKey?.length);
    console.log('API Key starts with:', apiKey?.substring(0, 10));
    console.log('API Key ends with:', apiKey?.substring(apiKey.length - 10));

    const requestBody = {
      model: "claude-3-sonnet-20240229",
      messages: [
        {
          role: "user",
          content: "Say hello"
        }
      ]
    };

    const headers = {
      'anthropic-version': '2024-02-15',
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    };

    console.log('Making request with headers:', {
      ...headers,
      'x-api-key': 'sk-ant-***[hidden]***'  // Hide API key in logs
    });
    console.log('Request body:', requestBody);

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      requestBody,
      { headers }
    );

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);

    return NextResponse.json({ success: true, data: response.data });
  } catch (error: any) {
    console.error('Full error object:', {
      ...error,
      config: {
        ...error.config,
        headers: {
          ...error.config?.headers,
          'x-api-key': 'sk-ant-***[hidden]***'  // Hide API key in logs
        }
      }
    });
    console.error('Response data:', error.response?.data);
    console.error('Response status:', error.response?.status);
    console.error('Response headers:', error.response?.headers);
    
    return NextResponse.json({ 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status,
      headers: error.response?.headers
    });
  }
} 